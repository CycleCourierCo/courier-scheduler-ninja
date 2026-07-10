import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from "recharts";
import { DeliveryTimeAnalytics } from "@/services/analyticsService";

interface DeliveryTimeChartProps {
  data: DeliveryTimeAnalytics;
}

const DeliveryTimeChart = ({ data }: DeliveryTimeChartProps) => {
  const chartData = data.byCustomer.slice(0, 5).map(item => ({
    name: item.customer.length > 20 ? item.customer.substring(0, 20) + '...' : item.customer,
    collectionToDelivery: parseFloat(item.avgCollectionToDelivery.toFixed(1)),
    totalDuration: parseFloat(item.avgTotal.toFixed(1))
  }));

  const chartConfig = {
    collectionToDelivery: {
      label: "Collection → Delivery",
      color: "hsl(var(--primary))",
    },
    totalDuration: {
      label: "Total Duration",
      color: "hsl(var(--muted-foreground))",
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Delivery Performance</CardTitle>
        <CardDescription>
          Time from collection to delivery and total order duration
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid grid-cols-3 gap-4">
          <div className="rounded-lg border bg-card p-3">
            <p className="text-sm text-muted-foreground">Collection → Delivery</p>
            <p className="text-2xl font-bold">
              {data.averageCollectionToDelivery.toFixed(1)}h
            </p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-sm text-muted-foreground">Total Duration</p>
            <p className="text-2xl font-bold">
              {data.averageTotalDuration.toFixed(1)}h
            </p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-sm text-muted-foreground">SLA (&lt;48h)</p>
            <p className={`text-2xl font-bold ${
              data.deliverySLA >= 90 ? 'text-primary' : 
              data.deliverySLA >= 75 ? 'text-yellow-600' : 
              'text-destructive'
            }`}>
              {data.deliverySLA.toFixed(0)}%
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
              <Legend />
              <Bar dataKey="collectionToDelivery" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
              <Bar dataKey="totalDuration" fill="hsl(var(--muted-foreground))" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
        
        <p className="text-xs text-muted-foreground mt-2">
          Top 5 customers by slowest delivery time
        </p>
      </CardContent>
    </Card>
  );
};

export default DeliveryTimeChart;
