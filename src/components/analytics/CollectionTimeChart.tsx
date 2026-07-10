import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, Line, ComposedChart } from "recharts";
import { CollectionTimeAnalytics } from "@/services/analyticsService";

interface CollectionTimeChartProps {
  data: CollectionTimeAnalytics;
}

const CollectionTimeChart = ({ data }: CollectionTimeChartProps) => {
  const chartData = data.byCustomer.slice(0, 5).map(item => ({
    name: item.customer.length > 20 ? item.customer.substring(0, 20) + '...' : item.customer,
    hours: parseFloat(item.avgTime.toFixed(1))
  }));

  const chartConfig = {
    hours: {
      label: "Avg Hours",
      color: "hsl(var(--primary))",
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Collection Performance</CardTitle>
        <CardDescription>
          Average time from order creation to collection
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid grid-cols-2 gap-4">
          <div className="rounded-lg border bg-card p-3">
            <p className="text-sm text-muted-foreground">Avg Collection Time</p>
            <p className="text-2xl font-bold">
              {data.averageTimeToCollect.toFixed(1)}h
            </p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-sm text-muted-foreground">SLA (&lt;24h)</p>
            <p className={`text-2xl font-bold ${
              data.collectionSLA >= 90 ? 'text-primary' : 
              data.collectionSLA >= 75 ? 'text-yellow-600' : 
              'text-destructive'
            }`}>
              {data.collectionSLA.toFixed(0)}%
            </p>
          </div>
        </div>
        
        <ChartContainer config={chartConfig} className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="name" 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                label={{ value: 'Hours', angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))' }}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="hours" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
        
        <p className="text-xs text-muted-foreground mt-2">
          Top 5 customers by slowest collection time
        </p>
      </CardContent>
    </Card>
  );
};

export default CollectionTimeChart;
