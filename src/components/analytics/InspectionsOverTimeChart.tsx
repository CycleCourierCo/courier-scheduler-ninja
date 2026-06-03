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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface InspectionsOverTimeChartProps {
  data: { month: string; label: string; count: number }[];
}

const InspectionsOverTimeChart = ({ data }: InspectionsOverTimeChartProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Inspections Over Time</CardTitle>
      </CardHeader>
      <CardContent className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} />
            <Tooltip formatter={(v) => [`${v} inspections`, "Count"]} />
            <Legend />
            <Line
              type="monotone"
              dataKey="count"
              name="Inspections"
              stroke="hsl(var(--primary))"
              activeDot={{ r: 8 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default InspectionsOverTimeChart;
