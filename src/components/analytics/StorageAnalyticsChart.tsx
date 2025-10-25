import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StorageAnalytics } from "@/services/analyticsService";

interface StorageAnalyticsChartProps {
  data: StorageAnalytics;
}

const StorageAnalyticsChart = ({ data }: StorageAnalyticsChartProps) => {
  const chartConfig = {
    count: {
      label: "Orders",
      color: "hsl(var(--primary))",
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Storage Analytics</CardTitle>
        <CardDescription>
          Current storage status and duration distribution
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid grid-cols-2 gap-4">
          <div className="rounded-lg border bg-card p-3">
            <p className="text-sm text-muted-foreground">Bikes in Storage</p>
            <p className="text-2xl font-bold">{data.currentInStorage}</p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-sm text-muted-foreground">Avg Storage Duration</p>
            <p className="text-2xl font-bold">
              {data.averageDaysInStorage.toFixed(1)} days
            </p>
          </div>
        </div>
        
        <div className="mb-6">
          <h3 className="text-sm font-medium mb-3">Storage Duration Distribution</h3>
          <ChartContainer config={chartConfig} className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.storageDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="range" 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                />
                <YAxis 
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  label={{ value: 'Orders', angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))' }}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>

        {data.longestStoredBikes.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-3">Longest Stored Bikes</h3>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tracking #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Days in Storage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.longestStoredBikes.map((bike, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono text-sm">
                        {bike.orderId.substring(0, 12)}...
                      </TableCell>
                      <TableCell>{bike.customerName}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {bike.daysInStorage.toFixed(1)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StorageAnalyticsChart;
