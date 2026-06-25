import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { useMemo } from "react";
import {
  getStorageLevelsOverTime,
  type Granularity,
  type TimeRange,
} from "@/services/analyticsService";
import type { Order } from "@/types/order";

interface Props {
  orders: Order[];
  range: TimeRange;
  granularity: Granularity;
}

const StorageLevelsChart = ({ orders, range, granularity }: Props) => {
  const data = useMemo(
    () => getStorageLevelsOverTime(orders, range, granularity),
    [orders, range, granularity],
  );

  const chartConfig = {
    inStorage: { label: "In bays", color: "hsl(var(--primary))" },
    in: { label: "Entered", color: "hsl(var(--chart-2, var(--primary)))" },
    out: { label: "Left", color: "hsl(var(--muted-foreground))" },
  };

  const TrendIcon = data.netChange > 0 ? ArrowUp : data.netChange < 0 ? ArrowDown : Minus;
  const trendColor =
    data.netChange > 0
      ? "text-amber-600"
      : data.netChange < 0
      ? "text-emerald-600"
      : "text-muted-foreground";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Storage Bays Over Time</CardTitle>
        <CardDescription>
          Bikes sitting in the bays at each {granularity}, plus what came in and went out.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">Currently in bays</p>
            <p className="text-2xl font-bold">{data.currentInStorage}</p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">Peak in range</p>
            <p className="text-2xl font-bold">{data.peak}</p>
            {data.peakLabel && (
              <p className="text-xs text-muted-foreground truncate">{data.peakLabel}</p>
            )}
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">Average level</p>
            <p className="text-2xl font-bold">{data.avg.toFixed(1)}</p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">Net change</p>
            <p className={`text-2xl font-bold inline-flex items-center gap-1 ${trendColor}`}>
              <TrendIcon className="h-5 w-5" />
              {data.netChange > 0 ? "+" : ""}
              {data.netChange}
            </p>
          </div>
        </div>

        <ChartContainer config={chartConfig} className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.points}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="label"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend />
              <Bar dataKey="in" name="Entered" fill="hsl(var(--primary))" opacity={0.35} />
              <Bar dataKey="out" name="Left" fill="hsl(var(--muted-foreground))" opacity={0.35} />
              <Area
                type="monotone"
                dataKey="inStorage"
                name="In bays"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.15}
                strokeWidth={2}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export default StorageLevelsChart;
