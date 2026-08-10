import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Point {
  label: string;
  success: number;
  failed: number;
}

interface Props {
  data: Point[];
  title: string;
  description?: string;
}

const DeliveryTrendChart = ({ data, title, description }: Props) => (
  <Card>
    <CardHeader>
      <CardTitle>{title}</CardTitle>
      {description && <CardDescription>{description}</CardDescription>}
    </CardHeader>
    <CardContent className="h-72 sm:h-80 w-full min-w-0 overflow-hidden">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" angle={-45} textAnchor="end" height={56} tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} width={40} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          <Area
            type="monotone"
            dataKey="success"
            name="Delivered"
            stackId="1"
            stroke="hsl(var(--primary))"
            fill="hsl(var(--primary) / 0.3)"
          />
          <Area
            type="monotone"
            dataKey="failed"
            name="Failed"
            stackId="1"
            stroke="hsl(var(--destructive))"
            fill="hsl(var(--destructive) / 0.3)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>
);

export default DeliveryTrendChart;
