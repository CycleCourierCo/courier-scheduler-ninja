
import { BikeAnalytics } from "@/services/analyticsService";
import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface BikeBrandsChartProps {
  data: BikeAnalytics[];
}

const COLORS = ['#4a65d5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9', '#ec4899', '#14b8a6', '#f43f5e', '#8b5cf6'];

const BikeBrandsChart = ({ data }: BikeBrandsChartProps) => {
  // Limit to top 10 brands and group the rest as "Other"
  const processedData = [...data];
  
  if (processedData.length > 10) {
    const topBrands = processedData.slice(0, 9);
    const otherBrands = processedData.slice(9);
    
    const otherCount = otherBrands.reduce((sum, item) => sum + item.count, 0);
    const otherPercentage = otherBrands.reduce((sum, item) => sum + item.percentage, 0);
    
    topBrands.push({
      brand: 'Other',
      count: otherCount,
      percentage: otherPercentage
    });
    
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bike Brands Distribution</CardTitle>
        </CardHeader>
        <CardContent className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={topBrands}
                cx="50%"
                cy="50%"
                labelLine={true}
                outerRadius={120}
                fill="#8884d8"
                dataKey="count"
                nameKey="brand"
                label={({ brand, percentage }) => `${brand} (${percentage.toFixed(1)}%)`}
              >
                {topBrands.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value, name, props) => [`${value} (${props.payload.percentage.toFixed(1)}%)`, props.payload.brand]} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bike Brands Distribution</CardTitle>
      </CardHeader>
      <CardContent className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={processedData}
              cx="50%"
              cy="50%"
              labelLine={true}
              outerRadius={120}
              fill="#8884d8"
              dataKey="count"
              nameKey="brand"
              label={({ brand, percentage }) => `${brand} (${percentage.toFixed(1)}%)`}
            >
              {processedData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value, name, props) => [`${value} (${props.payload.percentage.toFixed(1)}%)`, props.payload.brand]} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default BikeBrandsChart;
