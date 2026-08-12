import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ApiOrdersPoint } from "@/services/apiWebhookAnalyticsService";

interface Props {
  data: ApiOrdersPoint[];
}

const ApiOrdersOverTimeChart = ({ data }: Props) => {
  const api = data.reduce((s, d) => s + d.api, 0);
  const shopify = data.reduce((s, d) => s + d.shopify, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>API orders created</CardTitle>
        <CardDescription>
          {api} via API key · {shopify} via Shopify
        </CardDescription>
      </CardHeader>
      <CardContent className="h-72 sm:h-80 w-full min-w-0 overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" angle={-45} textAnchor="end" height={56} tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} width={32} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="api" stackId="a" name="API key" fill="hsl(var(--primary))" />
            <Bar dataKey="shopify" stackId="a" name="Shopify" fill="hsl(var(--muted-foreground))" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default ApiOrdersOverTimeChart;
