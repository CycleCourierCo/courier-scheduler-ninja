import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Order } from "@/types/order";
import {
  getCustomerOrdersOverTimeRanged,
  getCustomerEarliestOrderDate,
  type Granularity,
  type TimeRange,
} from "@/services/analyticsService";
import TimeSeriesFilters from "./TimeSeriesFilters";

interface CustomerOrdersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerName: string | null;
  orders: Order[];
}

const defaultRange = (): TimeRange => {
  const end = new Date();
  const start = new Date();
  start.setMonth(end.getMonth() - 6);
  return { start, end };
};

const CustomerOrdersDialog = ({
  open,
  onOpenChange,
  customerName,
  orders,
}: CustomerOrdersDialogProps) => {
  const [range, setRange] = useState<TimeRange>(defaultRange());
  const [granularity, setGranularity] = useState<Granularity>("month");

  // Reset filters when switching to a different customer
  useEffect(() => {
    if (customerName) {
      setRange(defaultRange());
      setGranularity("month");
    }
  }, [customerName]);

  const earliestDate = useMemo(
    () => (customerName ? getCustomerEarliestOrderDate(orders, customerName) ?? undefined : undefined),
    [orders, customerName],
  );

  const data = useMemo(() => {
    if (!customerName) return [];
    return getCustomerOrdersOverTimeRanged(orders, customerName, range, granularity);
  }, [orders, customerName, range, granularity]);

  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{customerName ?? "Customer"}</DialogTitle>
          <DialogDescription>
            {total} order{total === 1 ? "" : "s"} in selected range
          </DialogDescription>
        </DialogHeader>

        <div className="pb-2">
          <TimeSeriesFilters
            range={range}
            granularity={granularity}
            onRangeChange={setRange}
            onGranularityChange={setGranularity}
            minDate={earliestDate}
          />
        </div>

        <div className="h-80 w-full">
          {data.length === 0 || total === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No orders in this range.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 6,
                  }}
                  formatter={(value) => [`${value} orders`, "Count"]}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerOrdersDialog;
