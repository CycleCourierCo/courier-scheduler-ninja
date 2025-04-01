
import { CustomerOrderCount } from "@/services/analyticsService";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TopCustomersChartProps {
  data: CustomerOrderCount[];
}

const TopCustomersChart = ({ data }: TopCustomersChartProps) => {
  // Format data for display
  const formattedData = data.map(item => ({
    ...item,
    name: item.customerName.length > 15 
      ? `${item.customerName.substring(0, 12)}...` 
      : item.customerName,
    fullName: item.customerName
  }));

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>Top Customers by Order Count</CardTitle>
      </CardHeader>
      <CardContent className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={formattedData}
            margin={{ top: 5, right: 30, left: 20, bottom: 70 }}
            layout="vertical"
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis 
              dataKey="name" 
              type="category" 
              width={150}
            />
            <Tooltip 
              formatter={(value) => [`${value} orders`, 'Count']}
              labelFormatter={(value) => `Customer: ${formattedData.find(d => d.name === value)?.fullName}`}
            />
            <Legend />
            <Bar 
              dataKey="count" 
              name="Number of Orders" 
              fill="#4a65d5" 
              radius={[0, 4, 4, 0]}
              barSize={20}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default TopCustomersChart;
