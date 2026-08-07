import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { WeeklyBikeRow } from "@/services/driverAnalyticsService";

interface Props {
  data: WeeklyBikeRow[];
}

const DriverBikesChart = ({ data }: Props) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-base sm:text-lg">Bikes Collected vs Delivered</CardTitle>
      <CardDescription>Per week (Mon–Sun), counted from bike quantity on each job</CardDescription>
    </CardHeader>
    <CardContent>
      {data.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">No jobs matched this driver in the period</div>
      ) : (
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
              />
              <Legend />
              <Bar dataKey="collected" name="Collected" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="delivered" name="Delivered" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </CardContent>
  </Card>
);

export default DriverBikesChart;
