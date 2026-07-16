import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DailyBikeValuePoint } from "@/services/bikeValueAnalyticsService";
import { formatGBP } from "@/services/bikeValueAnalyticsService";

interface Props {
  data: DailyBikeValuePoint[];
}

const DailyBikeValueChart = ({ data }: Props) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily Bike Value</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-sm text-muted-foreground py-12 text-center">
            No bike value data in this period.
          </div>
        ) : (
          <div className="w-full h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => formatGBP(Number(v))}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => formatGBP(Number(v))}
                />
                <Tooltip
                  formatter={(value: any, name: string) => {
                    if (name === "Bikes") return [value, name];
                    return [formatGBP(Number(value)), name];
                  }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="totalValue" name="Total Value" fill="hsl(var(--primary))" />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="avgValuePerBike"
                  name="Avg Value / Bike"
                  stroke="hsl(var(--destructive))"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DailyBikeValueChart;
