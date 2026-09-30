import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, ExternalLink, PackageOpen } from "lucide-react";

import Layout from "@/components/Layout";
import DashboardHeader from "@/components/DashboardHeader";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import type { ContactInfo, Address } from "@/types/order";
import { getGroupedBikes } from "@/utils/bikeSummary";
import ExpiringDatesMap, { type MapLeg } from "@/components/expiring/ExpiringDatesMap";

const londonDay = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(d);
};

const londonToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());

const DAY_MS = 24 * 60 * 60 * 1000;
const dayDiff = (a: string, b: string) =>
  Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / DAY_MS);

const formatDay = (key: string) =>
  new Date(`${key}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

interface ExpiringLeg {
  key: string;
  orderId: string;
  trackingNumber: string | null;
  customerName: string;
  bikeLabel: string;
  legType: "collection" | "delivery";
  dates: string[];
  lastDate: string;
  daysLeft: number; // negative = expired
  askedForNewDates: boolean;
  lat: number | null;
  lng: number | null;
}

const ExpiringDatesPage = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["expiring-dates"],
    queryFn: async () => {
      const [ordersRes, availRes] = await Promise.all([
        supabase
          .from("orders")
          .select(
            "id,tracking_number,sender,receiver,bikes,bike_brand,bike_model,bike_type," +
              "pickup_date,delivery_date,scheduled_pickup_date,scheduled_delivery_date," +
              "order_collected,order_delivered,is_box_my_bike,is_warehouse_storage,status",
          )
          .not("status", "in", "(cancelled,delivered)"),
        supabase
          .from("order_leg_availability")
          .select("order_id,leg_type,availability_status"),
      ]);
      if (ordersRes.error) throw ordersRes.error;
      if (availRes.error) throw availRes.error;
      return { orders: ordersRes.data ?? [], availability: availRes.data ?? [] };
    },
    staleTime: 60 * 1000,
  });

  const legs = useMemo<ExpiringLeg[]>(() => {
    if (!data) return [];
    const today = londonToday();
    const asked = new Set(
      data.availability
        .filter((a) => a.availability_status === "awaiting_new_dates")
        .map((a) => `${a.order_id}:${a.leg_type}`),
    );

    const out: ExpiringLeg[] = [];
    for (const o of data.orders as any[]) {
      const sender = o.sender as (ContactInfo & { address: Address }) | null;
      const receiver = o.receiver as (ContactInfo & { address: Address }) | null;
      const bikeLabel =
        getGroupedBikes(o as any)
          .map((b) => (b.quantity > 1 ? `${b.quantity}× ${b.label}` : b.label))
          .join(", ") || "Bike";

      const consider = (
        legType: "collection" | "delivery",
        raw: unknown,
        eligible: boolean,
        customerName: string,
        contact: (ContactInfo & { address: Address }) | null,
      ) => {
        if (!eligible) return;
        const dates = [
          ...new Set(
            (Array.isArray(raw) ? raw : [])
              .map(londonDay)
              .filter((d): d is string => !!d),
          ),
        ].sort();
        if (dates.length === 0) return; // never given dates — not shown on this page
        const lastDate = dates[dates.length - 1];
        const daysLeft = dayDiff(lastDate, today);
        if (daysLeft > 3) return; // plenty of time left
        out.push({
          key: `${o.id}:${legType}`,
          orderId: o.id,
          trackingNumber: o.tracking_number,
          customerName,
          bikeLabel,
          legType,
          dates,
          lastDate,
          daysLeft,
          askedForNewDates: asked.has(`${o.id}:${legType}`),
          lat: contact?.address?.lat ?? null,
          lng: contact?.address?.lon ?? null,
        });
      };

      consider(
        "collection",
        o.pickup_date,
        !o.order_collected && !o.scheduled_pickup_date,
        sender?.name ?? "Unknown",
        sender ?? null,
      );
      consider(
        "delivery",
        o.delivery_date,
        !o.order_delivered && !o.scheduled_delivery_date && !o.is_box_my_bike && !o.is_warehouse_storage,
        receiver?.name ?? "Unknown",
        receiver ?? null,
      );
    }
    return out;
  }, [data]);

  const mapLegs = useMemo<MapLeg[]>(
    () =>
      legs
        .filter((l) => l.lat != null && l.lng != null)
        .map((l) => ({
          key: l.key,
          trackingNumber: l.trackingNumber,
          customerName: l.customerName,
          bikeLabel: l.bikeLabel,
          legType: l.legType,
          dates: l.dates,
          daysLeft: l.daysLeft,
          lat: l.lat as number,
          lng: l.lng as number,
        })),
    [legs],
  );

  const columns = useMemo(() => {
    const groups: { title: string; legs: ExpiringLeg[] }[] = [
      { title: "Last date today", legs: [] },
      { title: "Last date tomorrow", legs: [] },
      { title: "Last date in 2–3 days", legs: [] },
      { title: "Expired", legs: [] },
    ];
    for (const leg of legs) {
      if (leg.daysLeft === 0) groups[0].legs.push(leg);
      else if (leg.daysLeft === 1) groups[1].legs.push(leg);
      else if (leg.daysLeft <= 3) groups[2].legs.push(leg);
      else groups[3].legs.push(leg);
    }
    // Expired: most-overdue first; others already soonest-first via lastDate sort below
    for (const g of groups) {
      g.legs.sort((a, b) => a.daysLeft - b.daysLeft || a.lastDate.localeCompare(b.lastDate));
    }
    return groups;
  }, [legs]);

  return (
    <Layout>
      <div className="office-density container py-6">
        <DashboardHeader>
          <div className="flex items-start gap-3">
            <CalendarClock className="mt-1 h-6 w-6 text-muted-foreground" />
            <div>
              <h1>Expiring dates</h1>
              <p className="text-muted-foreground">
                Jobs whose customer-chosen dates are about to run out, or already have.
              </p>
            </div>
          </div>
        </DashboardHeader>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-primary"></div>
          </div>
        ) : (
          <>
            {mapLegs.length > 0 && <ExpiringDatesMap legs={mapLegs} />}
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {columns.map((col) => (
              <section key={col.title} className="rounded-lg border bg-card">
                <header className="flex items-center justify-between border-b px-3 py-2">
                  <h2 className="text-sm font-semibold">{col.title}</h2>
                  <Badge variant="secondary">{col.legs.length}</Badge>
                </header>
                <div className="flex flex-col gap-2 p-2">
                  {col.legs.length === 0 ? (
                    <p className="px-1 py-4 text-center text-sm text-muted-foreground">None</p>
                  ) : (
                    col.legs.map((leg) => (
                      <article key={leg.key} className="rounded-md border bg-background p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">
                            {leg.trackingNumber ?? "No tracking number"}
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <Badge variant={leg.legType === "collection" ? "default" : "outline"}>
                              {leg.legType === "collection" ? "Collection" : "Delivery"}
                            </Badge>
                            <a
                              href={`/orders/${leg.orderId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label="Open order in new tab"
                              title="Open order in new tab"
                              className="text-muted-foreground transition-colors hover:text-foreground"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </span>
                        </div>
                        <p className="mt-1 truncate text-sm">{leg.customerName}</p>
                        <p className="truncate text-xs text-muted-foreground">{leg.bikeLabel}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {leg.dates.map(formatDay).join(" · ")}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          {leg.daysLeft < 0 ? (
                            <Badge variant="destructive">
                              {Math.abs(leg.daysLeft)} day{Math.abs(leg.daysLeft) === 1 ? "" : "s"} expired
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              {leg.daysLeft === 0
                                ? "Last day today"
                                : `${leg.daysLeft} day${leg.daysLeft === 1 ? "" : "s"} left`}
                            </Badge>
                          )}
                          {leg.askedForNewDates && (
                            <Badge variant="outline">Asked</Badge>
                          )}
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </section>
            ))}
            </div>
            </>
          )}

        {!isLoading && legs.length === 0 && (
          <div className="mt-6 flex items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-muted-foreground">
            <PackageOpen className="h-5 w-5" />
            <p>No jobs with dates expiring within 3 days or already expired.</p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ExpiringDatesPage;
