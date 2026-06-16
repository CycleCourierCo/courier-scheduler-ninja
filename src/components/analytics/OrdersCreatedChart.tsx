import { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import TimeSeriesFilters from "./TimeSeriesFilters";
import {
  getOrdersCreatedSeries,
  type Granularity,
  type TimeRange,
} from "@/services/analyticsService";
import type { Order } from "@/types/order";

interface OrdersCreatedChartProps {
  orders: Order[];
}

const defaultRange = (): TimeRange => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 84);
  return { start, end };
};

const OrdersCreatedChart = ({ orders }: OrdersCreatedChartProps) => {
  const [range, setRange] = useState<TimeRange>(defaultRange);
  const [granularity, setGranularity] = useState<Granularity>("week");

  const minDate = useMemo(() => {
    let min: number | null = null;
    for (const o of orders) {
      const t = new Date(o.createdAt).getTime();
      if (!isNaN(t) && (min === null || t < min)) min = t;
    }
    return min ? new Date(min) : undefined;
  }, [orders]);

  const data = useMemo(
    () => getOrdersCreatedSeries(orders, range, granularity),
    [orders, range, granularity],
  );

  const total = data.reduce((s, p) => s + p.count, 0);

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 space-y-0">
        <div>
          <CardTitle>Orders Created</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">{total} orders in range</p>
        </div>
        <TimeSeriesFilters
          range={range}
          granularity={granularity}
          onRangeChange={setRange}
          onGranularityChange={setGranularity}
          minDate={minDate}
        />
      </CardHeader>
      <CardContent className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" angle={-45} textAnchor="end" height={70} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} />
            <Tooltip formatter={(v) => [`${v} orders`, "Created"]} labelFormatter={(l) => String(l)} />
            <Legend />
            <Line type="monotone" dataKey="count" name="Orders Created" stroke="#4a65d5" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default OrdersCreatedChart;
