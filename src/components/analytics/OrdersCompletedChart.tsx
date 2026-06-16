import { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import TimeSeriesFilters from "./TimeSeriesFilters";
import {
  getOrdersCompletedSeries,
  type Granularity,
  type TimeRange,
} from "@/services/analyticsService";
import type { Order } from "@/types/order";

interface OrdersCompletedChartProps {
  orders: Order[];
}

const defaultRange = (): TimeRange => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 84);
  return { start, end };
};

const OrdersCompletedChart = ({ orders }: OrdersCompletedChartProps) => {
  const [range, setRange] = useState<TimeRange>(defaultRange);
  const [granularity, setGranularity] = useState<Granularity>("week");

  const data = useMemo(
    () => getOrdersCompletedSeries(orders, range, granularity),
    [orders, range, granularity],
  );

  const totals = data.reduce(
    (acc, p) => ({
      orders: acc.orders + p.orders,
      collections: acc.collections + p.collections,
      deliveries: acc.deliveries + p.deliveries,
    }),
    { orders: 0, collections: 0, deliveries: 0 },
  );

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 space-y-0">
        <div>
          <CardTitle>Orders Completed</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {totals.orders} orders · {totals.collections} collections · {totals.deliveries} deliveries
          </p>
        </div>
        <TimeSeriesFilters
          range={range}
          granularity={granularity}
          onRangeChange={setRange}
          onGranularityChange={setGranularity}
        />
      </CardHeader>
      <CardContent className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" angle={-45} textAnchor="end" height={70} tick={{ fontSize: 11 }} interval={Math.max(0, Math.floor(data.length / 6) - 1)} minTickGap={12} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="orders" name="Orders Completed" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="collections" name="Collections" stroke="#4a65d5" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="deliveries" name="Deliveries" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default OrdersCompletedChart;
