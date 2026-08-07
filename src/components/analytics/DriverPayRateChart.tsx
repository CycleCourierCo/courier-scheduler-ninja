import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { PayRatePoint } from "@/services/driverAnalyticsService";

interface Props {
  data: PayRatePoint[];
}

const DriverPayRateChart = ({ data }: Props) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-base sm:text-lg">Pay Rate Over Time</CardTitle>
      <CardDescription>Hourly rate and van allowance as recorded on each approved timeslip</CardDescription>
    </CardHeader>
    <CardContent>
      {data.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">No pay rate history in this period</div>
      ) : (
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v: number, n: string) => [`£${Number(v).toFixed(2)}`, n]}
                contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
              />
              <Legend />
              <Line
                type="stepAfter"
                dataKey="rate"
                name="Hourly rate"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="stepAfter"
                dataKey="vanAllowance"
                name="Van allowance"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </CardContent>
  </Card>
);

export default DriverPayRateChart;
