import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarCheck, ChevronDown, ChevronUp, Check } from "lucide-react";
import { differenceInCalendarDays, format } from "date-fns";
import { OrderData } from "@/pages/JobScheduling";
import { needsCollectionLeg, needsDeliveryLeg } from "./heatJobPoints";
import { getLegContact } from "@/utils/niDelivery";
import { cn } from "@/lib/utils";

interface GuaranteedRow {
  key: string;
  order: OrderData;
  type: "pickup" | "delivery";
  guaranteedDate: string;
  daysLeft: number;
  contactName: string;
  town: string;
  postcode: string;
  bikes: number;
  collectionBooked: boolean;
}

interface GuaranteedDatePanelProps {
  orders: OrderData[];
  selectedKeys: Set<string>;
  onToggleJob: (order: OrderData, type: "pickup" | "delivery") => void;
}

const formatDay = (d: string) =>
  format(new Date(`${d}T12:00:00`), "EEE d MMM yyyy");

const GuaranteedDatePanel = ({ orders, selectedKeys, onToggleJob }: GuaranteedDatePanelProps) => {
  const [collapsed, setCollapsed] = useState(false);

  const rows = useMemo<GuaranteedRow[]>(() => {
    const today = new Date();
    const out: GuaranteedRow[] = [];

    orders.forEach((order) => {
      const date = (order as any).guaranteed_delivery_date as string | null;
      if (!(order as any).guaranteed_delivery || !date) return;

      const legs: ("pickup" | "delivery")[] = [];
      if (needsCollectionLeg(order)) legs.push("pickup");
      if (needsDeliveryLeg(order)) legs.push("delivery");
      if (legs.length === 0) return;

      legs.forEach((type) => {
        const contact: any = getLegContact(order, type);
        out.push({
          key: `${order.id}-${type}`,
          order,
          type,
          guaranteedDate: date,
          daysLeft: differenceInCalendarDays(new Date(`${date}T12:00:00`), today),
          contactName: contact?.name || "",
          town: contact?.address?.city || "",
          postcode: contact?.address?.zipCode || "",
          bikes: order.bike_quantity || 1,
          collectionBooked: !!order.scheduled_pickup_date,
        });
      });
    });

    return out.sort(
      (a, b) =>
        a.guaranteedDate.localeCompare(b.guaranteedDate) || a.type.localeCompare(b.type)
    );
  }, [orders]);

  if (rows.length === 0) return null;

  const urgency = (daysLeft: number) => {
    if (daysLeft <= 0) return "border-red-500/60 bg-red-50 dark:bg-red-950/30";
    if (daysLeft <= 2) return "border-amber-500/60 bg-amber-50 dark:bg-amber-950/30";
    return "border-border bg-muted/30";
  };

  const daysLabel = (daysLeft: number) => {
    if (daysLeft < 0) return `${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? "" : "s"} overdue`;
    if (daysLeft === 0) return "Today";
    if (daysLeft === 1) return "Tomorrow";
    return `${daysLeft} days left`;
  };

  return (
    <Card className="border-green-600/40">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-green-600" />
            Guaranteed dates
            <Badge variant="secondary">{rows.length} pending</Badge>
          </span>
          <Button variant="ghost" size="sm" onClick={() => setCollapsed((c) => !c)}>
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        </CardTitle>
      </CardHeader>
      {!collapsed && (
        <CardContent className="space-y-2">
          {rows.map((row) => {
            const selected = selectedKeys.has(row.key);
            return (
              <button
                key={row.key}
                type="button"
                onClick={() => onToggleJob(row.order, row.type)}
                className={cn(
                  "w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent",
                  urgency(row.daysLeft),
                  selected && "ring-2 ring-primary"
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  {selected && <Check className="h-4 w-4 text-primary" />}
                  <span className="font-medium break-all">{row.order.tracking_number}</span>
                  <Badge variant={row.type === "pickup" ? "outline" : "secondary"}>
                    {row.type === "pickup" ? "Collection due" : "Delivery due"}
                  </Badge>
                  <Badge
                    className={cn(
                      "text-white",
                      row.daysLeft <= 0
                        ? "bg-red-600 hover:bg-red-600"
                        : row.daysLeft <= 2
                        ? "bg-amber-600 hover:bg-amber-600"
                        : "bg-green-600 hover:bg-green-600"
                    )}
                  >
                    {formatDay(row.guaranteedDate)} · {daysLabel(row.daysLeft)}
                  </Badge>
                  <Badge variant="outline">{row.bikes} bike{row.bikes === 1 ? "" : "s"}</Badge>
                  {row.type === "delivery" && (
                    <Badge variant={row.collectionBooked ? "outline" : "destructive"}>
                      {row.collectionBooked ? "Collection booked" : "Collection not booked"}
                    </Badge>
                  )}
                </div>
                <div className="mt-1 text-sm text-muted-foreground break-words">
                  {[row.contactName, row.town, row.postcode].filter(Boolean).join(" · ")}
                </div>
              </button>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
};

export default GuaranteedDatePanel;
