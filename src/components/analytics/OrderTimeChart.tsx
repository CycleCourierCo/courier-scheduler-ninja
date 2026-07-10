
import { OrderCountByTime } from "@/services/analyticsService";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, parseISO, addDays } from "date-fns";

interface OrderTimeChartProps {
  data: OrderCountByTime[];
}

const OrderTimeChart = ({ data }: OrderTimeChartProps) => {
  // Format date for display as week range (Mon-Sun)
  const formattedData = data.map(item => {
    const weekStart = parseISO(item.date);
    const weekEnd = addDays(weekStart, 6);
    return {
      ...item,
      formattedDate: `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')}`
    };
  });

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>Orders by Week</CardTitle>
      </CardHeader>
      <CardContent className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={formattedData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="formattedDate" 
              angle={-45} 
              textAnchor="end" 
              height={60} 
              tick={{ fontSize: 12 }}
            />
            <YAxis />
            <Tooltip formatter={(value) => [`${value} orders`, 'Count']} labelFormatter={(value) => `Date: ${value}`} />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="count" 
              name="Number of Orders" 
              stroke="#4a65d5" 
              activeDot={{ r: 8 }} 
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default OrderTimeChart;
