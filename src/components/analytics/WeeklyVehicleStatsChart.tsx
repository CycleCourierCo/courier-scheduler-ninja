import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { WeeklyVehicleStat } from "@/services/vehicleAnalyticsService";

interface Props {
  data: WeeklyVehicleStat[];
}

const WeeklyVehicleStatsChart = ({ data }: Props) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">Weekly Miles, Routes & Drivers</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  color: "hsl(var(--foreground))",
                }}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="miles" name="Miles" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="routes" name="Routes" stroke="hsl(var(--chart-2, var(--accent)))" strokeWidth={2} />
              <Line yAxisId="right" type="monotone" dataKey="drivers" name="Drivers" stroke="hsl(var(--destructive))" strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default WeeklyVehicleStatsChart;
