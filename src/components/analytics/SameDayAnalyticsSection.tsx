import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, CheckCircle2, Clock, Repeat, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import StatsCard from "@/components/analytics/StatsCard";
import type { Order } from "@/types/order";
import type { TimeRange } from "@/services/analyticsService";
import { classifySameDay, summariseSameDay, londonDate, type SameDayOutcome, type SameDayRow } from "@/lib/sameDayAnalytics";

const LABEL: Record<SameDayOutcome, string> = {
  success: "Same day", failed_collection: "Failed collection", failed_delivery: "Failed delivery",
  slipped: "Delivered late", cancelled: "Cancelled", in_progress: "Not finished",
};
const VARIANT: Record<SameDayOutcome, "default" | "destructive" | "secondary" | "outline"> = {
  success: "default", failed_collection: "destructive", failed_delivery: "destructive",
  slipped: "secondary", cancelled: "outline", in_progress: "outline",
};

export default function SameDayAnalyticsSection({ orders, range }: { orders: Order[]; range: TimeRange }) {
  const [search, setSearch] = useState("");
  const [problemsOnly, setProblemsOnly] = useState(true);

  const rows = useMemo(() => {
    const start = londonDate(range.start), end = londonDate(range.end);
    const out: SameDayRow[] = [];
    for (const o of orders) {
      const r = classifySameDay({
        id: o.id, trackingNumber: o.trackingNumber, status: o.status,
        customer: (o as any).companyName || o.sender?.name,
        scheduledPickupDate: o.scheduledPickupDate, scheduledDeliveryDate: o.scheduledDeliveryDate,
        pickupId: o.trackingEvents?.shipday?.pickup_id, deliveryId: o.trackingEvents?.shipday?.delivery_id,
        updates: o.trackingEvents?.shipday?.updates as any,
        driver: o.delivery_driver_name || o.collection_driver_name,
      });
      if (r && r.plannedDate >= start && r.plannedDate <= end) out.push(r);
    }
    return out.sort((a, b) => b.plannedDate.localeCompare(a.plannedDate));
  }, [orders, range]);

  const s = useMemo(() => summariseSameDay(rows), [rows]);

  const weekly = useMemo(() => {
    const m = new Map<string, Record<string, number | string>>();
    for (const r of rows) {
      const d = new Date(r.plannedDate + "T12:00:00Z");
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      const k = d.toISOString().slice(0, 10);
      const e = m.get(k) ?? { week: k, success: 0, failed: 0, slipped: 0, cancelled: 0 };
      const key = r.outcome === "success" ? "success" : r.outcome.startsWith("failed") ? "failed" : r.outcome === "slipped" ? "slipped" : r.outcome === "cancelled" ? "cancelled" : null;
      if (key) e[key] = (e[key] as number) + 1;
      m.set(k, e);
    }
    return [...m.values()].sort((a, b) => String(a.week).localeCompare(String(b.week)));
  }, [rows]);

  const shown = rows.filter((r) =>
    (!problemsOnly || (r.outcome !== "success" && r.outcome !== "in_progress")) &&
    (!search || `${r.trackingNumber} ${r.customer} ${r.driver}`.toLowerCase().includes(search.toLowerCase())));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-4">
        <StatsCard title="Same-day jobs" value={s.total} description={`${s.inProgress} not finished yet`} icon={Zap} />
        <StatsCard title="Done same day" value={`${s.successRate.toFixed(0)}%`} description={`${s.success} of ${s.finished} finished`} icon={CheckCircle2} />
        <StatsCard title="Failed attempts" value={s.failedAttempts} description={`${s.failedCollection} collection · ${s.failedDelivery} delivery jobs`} icon={AlertTriangle} />
        <StatsCard title="Delivered late" value={s.slipped} description={`${s.cancelled} cancelled`} icon={Repeat} />
        <StatsCard title="Collect → deliver" value={`${s.avgTurnaroundHours.toFixed(1)}h`} description="Average time in van" icon={Clock} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Same-day jobs per week</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekly}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="week" fontSize={11} />
              <YAxis allowDecimals={false} fontSize={11} />
              <Tooltip />
              <Legend />
              <Bar dataKey="success" name="Same day" stackId="a" fill="hsl(var(--primary))" />
              <Bar dataKey="failed" name="Failed attempt" stackId="a" fill="hsl(var(--destructive))" />
              <Bar dataKey="slipped" name="Delivered late" stackId="a" fill="hsl(var(--accent))" />
              <Bar dataKey="cancelled" name="Cancelled" stackId="a" fill="hsl(var(--muted-foreground))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <CardTitle className="text-base">Same-day jobs ({shown.length})</CardTitle>
          <div className="flex gap-2">
            <Input placeholder="Search tracking, customer, driver" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 w-56" />
            <Button size="sm" variant={problemsOnly ? "default" : "outline"} onClick={() => setProblemsOnly(!problemsOnly)}>
              {problemsOnly ? "Problems only" : "All jobs"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr><th className="py-2 pr-3">Planned</th><th className="pr-3">Tracking</th><th className="pr-3">Customer</th><th className="pr-3">Driver</th><th className="pr-3">Result</th><th className="pr-3">Fails</th><th>Reason</th></tr>
            </thead>
            <tbody>
              {shown.slice(0, 200).map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="py-2 pr-3 whitespace-nowrap">{r.plannedDate}</td>
                  <td className="pr-3"><Link to={`/orders/${r.id}`} className="text-primary underline">{r.trackingNumber || "—"}</Link></td>
                  <td className="pr-3">{r.customer || "—"}</td>
                  <td className="pr-3">{r.driver || "—"}</td>
                  <td className="pr-3"><Badge variant={VARIANT[r.outcome]}>{LABEL[r.outcome]}</Badge>{r.outcome === "slipped" && r.deliveredDate ? <span className="ml-1 text-xs text-muted-foreground">{r.deliveredDate}</span> : null}</td>
                  <td className="pr-3">{r.failedCollections + r.failedDeliveries || ""}</td>
                  <td className="text-xs text-muted-foreground">{[...new Set(r.failReasons)].join("; ")}</td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">No jobs in this period</td></tr>}
            </tbody>
          </table>
          {shown.length > 200 && <p className="mt-2 text-xs text-muted-foreground">Showing the latest 200.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
