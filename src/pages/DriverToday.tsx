import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Navigation, Phone, CheckCircle2, MapPin, Loader2, Radio, Package, Truck } from "lucide-react";
import { toast } from "sonner";
import { normaliseStops, navigateUrl, telUrl, type DriverStop } from "@/lib/driverApp/stops";
import { flushProofs, queuedCount, queuedOrderIds, startShiftTracking, stopShiftTracking } from "@/lib/driverApp/native";
import { ProofDialog } from "@/components/driver/ProofDialog";

const SHIFT_KEY = "driver-on-shift-date";

interface LoadingItem {
  order_id: string; tracking_number: string | null; receiver_name: string | null;
  bike_brand: string | null; bike_model: string | null; bike_quantity: number;
  storage_locations: Array<{ bay?: string; position?: number }> | null;
  collected: boolean; collected_on_this_route: boolean; from_van: string | null;
}
interface DriverDay {
  assignment_id?: string; route_name?: string; registration?: string | null;
  started_at?: string | null; stop_count?: number; stops?: unknown; loading?: LoadingItem[];
}

/** Where a bike on the loading list comes from. */
export function loadingSource(i: LoadingItem): string {
  const bays = (i.storage_locations ?? []).filter((l) => l?.bay).map((l) => `Bay ${l.bay}${l.position ?? ""}`);
  if (bays.length) return `Depot · ${bays.join(", ")}`;
  if (i.collected_on_this_route) return "Collected on this route";
  if (i.from_van) return `From van ${i.from_van}`;
  return "Not in a bay — check with the office";
}

export default function DriverToday() {
  const { user } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");
  const [proofStop, setProofStop] = useState<DriverStop | null>(null);
  const [pending, setPending] = useState(0);
  const [queuedIds, setQueuedIds] = useState<Set<string>>(new Set());
  const [onShift, setOnShift] = useState(false);

  const [tab, setTab] = useState<"loading" | "stops">("loading");
  const [starting, setStarting] = useState(false);
  const route = useQuery({
    queryKey: ["driver-today", today],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("driver_today_stops" as any, { p_date: today });
      if (error) throw error;
      return data as DriverDay;
    },
  });
  const assigned = !!route.data?.assignment_id;
  const started = !!route.data?.started_at;

  async function startRoute() {
    if (!route.data?.assignment_id) return;
    setStarting(true);
    const { error } = await supabase.rpc("driver_start_route" as any, { p_assignment_id: route.data.assignment_id });
    setStarting(false);
    if (error) { toast.error("Couldn't start the route. Try again."); return; }
    if (!onShift) await toggleShift(true);
    setTab("stops");
    route.refetch();
  }
  const stops = normaliseStops(route.data?.stops);

  const done = useQuery({
    queryKey: ["driver-proofs", today, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("delivery_proofs" as any).select("order_id, stop_type").eq("driver_id", user!.id).gte("captured_at", `${today}T00:00:00`);
      return new Set(((data ?? []) as any[]).map((r) => `${r.order_id}:${r.stop_type}`));
    },
  });

  const refreshQueue = async () => { setPending(await queuedCount(user?.id)); setQueuedIds(await queuedOrderIds()); };

  useEffect(() => {
    if (!user) return;
    const flush = () => flushProofs(user.id).then(() => { refreshQueue(); done.refetch(); });
    flush();
    window.addEventListener("online", flush);
    // Resume an unfinished shift from today; drop stale ones automatically.
    if (localStorage.getItem(SHIFT_KEY) === today) toggleShift(true);
    else localStorage.removeItem(SHIFT_KEY);
    return () => window.removeEventListener("online", flush);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function toggleShift(start: boolean) {
    if (!user) return;
    if (start) {
      await startShiftTracking(user.id, (m) => toast.error(m));
      localStorage.setItem(SHIFT_KEY, today); setOnShift(true);
    } else {
      await stopShiftTracking(); localStorage.removeItem(SHIFT_KEY); setOnShift(false);
      toast.success("Shift ended — location sharing stopped");
    }
  }

  const isDone = (s: DriverStop) => done.data?.has(`${s.orderId}:${s.type}`) || (s.orderId ? queuedIds.has(s.orderId) : false);

  return (
    <Layout>
      <div className="container mx-auto max-w-xl space-y-4 px-3 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">Today's route</h1>
            <p className="truncate text-sm text-muted-foreground">{format(new Date(), "EEEE d MMMM")}{route.data?.route_name ? ` · ${route.data.route_name}` : ""}</p>
          </div>
          <Button variant={onShift ? "destructive" : "default"} className="h-12 shrink-0" onClick={() => toggleShift(!onShift)}>
            {onShift ? "End shift" : "Start shift"}
          </Button>
        </div>

        {onShift && (
          <div className="flex items-center gap-2 rounded-md border border-primary bg-primary/10 p-3 text-sm">
            <Radio className="h-4 w-4 animate-pulse text-primary" />Sharing your location with the office until you end your shift.
          </div>
        )}
        {pending > 0 && <p className="rounded-md bg-muted p-3 text-sm">{pending} proof{pending > 1 ? "s" : ""} waiting to upload — they'll send when you're back online.</p>}

        {route.isLoading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading your day…</p>}
        {route.error && <p className="text-sm text-destructive">Couldn't load your route. Check your signal and try again.</p>}
        {!route.isLoading && !route.error && !assigned && (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">No route assigned to you for today yet. The office will assign one.</CardContent></Card>
        )}

        {assigned && (
          <div className="grid grid-cols-2 gap-1 rounded-md border p-1" role="tablist">
            <Button role="tab" aria-selected={tab === "loading"} variant={tab === "loading" ? "default" : "ghost"} className="h-12" onClick={() => setTab("loading")}>
              <Package className="h-4 w-4" />Loading list
            </Button>
            <Button role="tab" aria-selected={tab === "stops"} variant={tab === "stops" ? "default" : "ghost"} className="h-12" onClick={() => setTab("stops")}>
              <MapPin className="h-4 w-4" />Stops
            </Button>
          </div>
        )}

        {assigned && tab === "loading" && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Van <span className="font-mono font-semibold text-foreground">{route.data?.registration || "not set"}</span> · {(route.data?.loading ?? []).length} to load</p>
            {(route.data?.loading ?? []).length === 0 && <Card><CardContent className="p-4 text-sm text-muted-foreground">Nothing to load for this route.</CardContent></Card>}
            {(route.data?.loading ?? []).map((i) => (
              <Card key={i.order_id}><CardContent className="space-y-1 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-sm font-semibold">{i.tracking_number}</span>
                  {i.bike_quantity > 1 && <Badge variant="secondary">×{i.bike_quantity}</Badge>}
                </div>
                <p className="text-sm">{[i.bike_brand, i.bike_model].filter(Boolean).join(" ") || "Bike"} · {i.receiver_name}</p>
                <p className="text-sm font-semibold text-primary">{loadingSource(i)}</p>
              </CardContent></Card>
            ))}
          </div>
        )}

        {assigned && tab === "stops" && !started && (
          <Card><CardContent className="space-y-3 p-6 text-center">
            <p className="text-sm text-muted-foreground">Your stops appear once you start the route at the depot.</p>
            <Button className="h-12 w-full" onClick={startRoute} disabled={starting}>
              {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}At depot — start route
            </Button>
          </CardContent></Card>
        )}

        <ol className={tab === "stops" ? "space-y-3" : "hidden"}>
          {stops.map((s, i) => (
            <li key={`${s.orderId}-${s.type}-${i}`}>
              <Card className={isDone(s) ? "opacity-60" : ""}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-lg font-bold">{i + 1}</span>
                      <Badge variant={s.type === "pickup" ? "secondary" : "default"}>{s.type === "pickup" ? "Collect" : "Deliver"}</Badge>
                      {s.estimatedTime && <span className="font-mono text-sm">{s.estimatedTime}</span>}
                    </div>
                    {isDone(s) && <CheckCircle2 className="h-5 w-5 text-primary" aria-label="Done" />}
                  </div>
                  <div>
                    <p className="font-semibold">{s.contactName}</p>
                    <p className="flex gap-1 text-sm text-muted-foreground"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{s.address}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Button asChild variant="outline" className="h-12"><a href={navigateUrl(s)} target="_blank" rel="noreferrer"><Navigation className="h-4 w-4" />Go</a></Button>
                    <Button asChild variant="outline" className="h-12" disabled={!s.phoneNumber}><a href={telUrl(s.phoneNumber)}><Phone className="h-4 w-4" />Call</a></Button>
                    <Button className="h-12" onClick={() => setProofStop(s)}>{isDone(s) ? "Again" : "Done"}</Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </div>
      {user && (
        <ProofDialog stop={proofStop} driverId={user.id} open={!!proofStop} onOpenChange={(o) => !o && setProofStop(null)}
          onSaved={() => { refreshQueue(); done.refetch(); }} />
      )}
    </Layout>
  );
}
