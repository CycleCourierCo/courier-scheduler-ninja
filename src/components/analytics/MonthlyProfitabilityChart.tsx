import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { format, addMonths, subMonths, startOfMonth } from "date-fns";
import { cn } from "@/lib/utils";

export interface WeeklyProfitabilityData {
  weekNumber: number;
  weekStart: string;
  weekEnd: string;
  formattedLabel: string;
  revenue: number;
  costs: number;
  profit: number;
}

interface MonthlyProfitabilityChartProps {
  data: WeeklyProfitabilityData[];
  selectedMonth: Date;
  onMonthChange: (month: Date) => void;
  totals?: {
    revenue: number;
    costs: number;
    profit: number;
  };
}

const MonthlyProfitabilityChart = ({ 
  data, 
  selectedMonth, 
  onMonthChange,
  totals 
}: MonthlyProfitabilityChartProps) => {
  const totalProfit = totals?.profit ?? data.reduce((sum, week) => sum + week.profit, 0);
  const isProfitable = totalProfit >= 0;

  const isCurrentMonth = () => {
    const now = new Date();
    return format(selectedMonth, 'yyyy-MM') === format(now, 'yyyy-MM');
  };

  const goToPreviousMonth = () => onMonthChange(subMonths(selectedMonth, 1));
  const goToNextMonth = () => onMonthChange(addMonths(selectedMonth, 1));
  const goToCurrentMonth = () => onMonthChange(startOfMonth(new Date()));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: £{entry.value.toFixed(2)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {isProfitable ? (
                <TrendingUp className="h-5 w-5 text-green-600" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-600" />
              )}
              Monthly Profitability Trend
            </CardTitle>
            <CardDescription>
              Weekly breakdown for {format(selectedMonth, 'MMMM yyyy')}
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPreviousMonth}
              className="flex-1 sm:flex-none"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md">
              <Calendar className="h-4 w-4" />
              <span className="font-medium">{format(selectedMonth, 'MMM yyyy')}</span>
            </div>
            
            {!isCurrentMonth() && (
              <Button
                variant="outline"
                size="sm"
                onClick={goToCurrentMonth}
                className="flex-1 sm:flex-none"
              >
                Current
              </Button>
            )}
            
            <Button
              variant="outline"
              size="sm"
              onClick={goToNextMonth}
              className="flex-1 sm:flex-none"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Monthly Summary */}
        {totals && (
          <div className="grid gap-4 md:grid-cols-3 mb-6 p-4 bg-muted/50 rounded-lg">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Monthly Revenue</p>
              <p className="text-xl font-bold text-green-600">
                £{totals.revenue.toFixed(2)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Monthly Costs</p>
              <p className="text-xl font-bold text-orange-600">
                £{totals.costs.toFixed(2)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Monthly Profit</p>
              <p className={cn(
                "text-xl font-bold",
                totals.profit >= 0 ? "text-green-600" : "text-red-600"
              )}>
                £{totals.profit.toFixed(2)}
              </p>
            </div>
          </div>
        )}

        {data.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            No data available for this month
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={data}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="formattedLabel" 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                stroke="hsl(var(--border))"
              />
              <YAxis 
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                stroke="hsl(var(--border))"
                label={{ 
                  value: 'Amount (£)', 
                  angle: -90, 
                  position: 'insideLeft',
                  style: { fill: 'hsl(var(--muted-foreground))' }
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              
              <Line 
                type="monotone" 
                dataKey="revenue" 
                name="Revenue" 
                stroke="#22c55e" 
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }} 
              />
              <Line 
                type="monotone" 
                dataKey="costs" 
                name="Costs" 
                stroke="#f97316" 
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line 
                type="monotone" 
                dataKey="profit" 
                name="Profit" 
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default MonthlyProfitabilityChart;