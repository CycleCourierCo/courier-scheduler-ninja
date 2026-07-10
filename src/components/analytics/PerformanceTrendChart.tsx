import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from "recharts";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import {
  getPerformanceTrendSeries,
  getPreviousPeriodRange,
  type Granularity,
  type TimeRange,
} from "@/services/analyticsService";
import type { Order } from "@/types/order";

interface Props {
  orders: Order[];
  range: TimeRange;
  granularity: Granularity;
}

const avg = (xs: (number | null)[]): number | null => {
  const v = xs.filter((x): x is number => x !== null);
  if (v.length === 0) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
};

const DeltaBadge = ({ current, previous }: { current: number | null; previous: number | null }) => {
  if (current === null || previous === null) {
    return <Badge variant="outline" className="gap-1"><Minus className="h-3 w-3" /> n/a</Badge>;
  }
  const delta = current - previous;
  if (Math.abs(delta) < 0.1) {
    return <Badge variant="outline" className="gap-1"><Minus className="h-3 w-3" /> flat</Badge>;
  }
  // Lower duration is better
  const better = delta < 0;
  const Icon = delta < 0 ? ArrowDown : ArrowUp;
  return (
    <Badge
      variant="outline"
      className={`gap-1 ${better ? "border-emerald-500/50 text-emerald-600" : "border-destructive/50 text-destructive"}`}
    >
      <Icon className="h-3 w-3" />
      {delta > 0 ? "+" : ""}{delta.toFixed(1)}h
    </Badge>
  );
};

const PerformanceTrendChart = ({ orders, range, granularity }: Props) => {
  const current = useMemo(
    () => getPerformanceTrendSeries(orders, range, granularity),
    [orders, range, granularity],
  );
  const previous = useMemo(
    () => getPerformanceTrendSeries(orders, getPreviousPeriodRange(range), granularity),
    [orders, range, granularity],
  );

  const summary = {
    c2c: { now: avg(current.map(p => p.creationToCollection)), prev: avg(previous.map(p => p.creationToCollection)) },
    c2d: { now: avg(current.map(p => p.collectionToDelivery)), prev: avg(previous.map(p => p.collectionToDelivery)) },
    cr2d: { now: avg(current.map(p => p.creationToDelivery)), prev: avg(previous.map(p => p.creationToDelivery)) },
  };

  const chartData = current.map(p => ({
    label: p.label,
    "Creation → Collection": p.creationToCollection !== null ? +p.creationToCollection.toFixed(2) : null,
    "Collection → Delivery": p.collectionToDelivery !== null ? +p.collectionToDelivery.toFixed(2) : null,
    "Creation → Delivery": p.creationToDelivery !== null ? +p.creationToDelivery.toFixed(2) : null,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Trend</CardTitle>
        <CardDescription>
          Average hours per stage, bucketed by the selected period. Arrows compare to the previous equivalent period.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border p-3 space-y-1">
            <p className="text-xs text-muted-foreground">Creation → Collection</p>
            <div className="flex items-center justify-between">
              <p className="text-xl font-bold">{summary.c2c.now !== null ? `${summary.c2c.now.toFixed(1)}h` : "—"}</p>
              <DeltaBadge current={summary.c2c.now} previous={summary.c2c.prev} />
            </div>
          </div>
          <div className="rounded-lg border p-3 space-y-1">
            <p className="text-xs text-muted-foreground">Collection → Delivery</p>
            <div className="flex items-center justify-between">
              <p className="text-xl font-bold">{summary.c2d.now !== null ? `${summary.c2d.now.toFixed(1)}h` : "—"}</p>
              <DeltaBadge current={summary.c2d.now} previous={summary.c2d.prev} />
            </div>
          </div>
          <div className="rounded-lg border p-3 space-y-1">
            <p className="text-xs text-muted-foreground">Creation → Delivery</p>
            <div className="flex items-center justify-between">
              <p className="text-xl font-bold">{summary.cr2d.now !== null ? `${summary.cr2d.now.toFixed(1)}h` : "—"}</p>
              <DeltaBadge current={summary.cr2d.now} previous={summary.cr2d.prev} />
            </div>
          </div>
        </div>

        <ChartContainer
          config={{
            "Creation → Collection": { label: "Creation → Collection", color: "hsl(var(--primary))" },
            "Collection → Delivery": { label: "Collection → Delivery", color: "hsl(var(--chart-2, 220 70% 50%))" },
            "Creation → Delivery": { label: "Creation → Delivery", color: "hsl(var(--muted-foreground))" },
          }}
          className="h-[320px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <YAxis
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                label={{ value: "Hours", angle: -90, position: "insideLeft", fill: "hsl(var(--muted-foreground))" }}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend />
              <Line type="monotone" dataKey="Creation → Collection" stroke="hsl(var(--primary))" strokeWidth={2} connectNulls dot={false} />
              <Line type="monotone" dataKey="Collection → Delivery" stroke="hsl(220 70% 50%)" strokeWidth={2} connectNulls dot={false} />
              <Line type="monotone" dataKey="Creation → Delivery" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="4 4" connectNulls dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export default PerformanceTrendChart;
