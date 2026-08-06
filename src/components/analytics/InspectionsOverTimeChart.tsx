import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface InspectionsOverTimeChartProps {
  data: { month: string; label: string; booked: number; completed: number }[];
}

const InspectionsOverTimeChart = ({ data }: InspectionsOverTimeChartProps) => {
  const totalBooked = data.reduce((sum, d) => sum + d.booked, 0);
  const totalCompleted = data.reduce((sum, d) => sum + d.completed, 0);
  const outstanding = Math.max(0, totalBooked - totalCompleted);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inspections Booked vs Completed</CardTitle>
        <CardDescription>
          {totalBooked} booked · {totalCompleted} completed · {outstanding} still outstanding
        </CardDescription>
      </CardHeader>
      <CardContent className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="booked"
              name="Booked"
              stroke="hsl(var(--primary))"
              activeDot={{ r: 8 }}
            />
            <Line
              type="monotone"
              dataKey="completed"
              name="Completed"
              stroke="hsl(var(--chart-2, var(--muted-foreground)))"
              activeDot={{ r: 8 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default InspectionsOverTimeChart;
