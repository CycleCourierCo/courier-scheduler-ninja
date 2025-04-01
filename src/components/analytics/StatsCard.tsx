
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

const StatsCard = ({ title, value, description, icon: Icon, trend }: StatsCardProps) => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
        {trend && (
          <div className={`flex items-center text-xs ${
            trend.isPositive ? 'text-green-500' : 'text-red-500'
          }`}>
            <span>{trend.isPositive ? '↑' : '↓'}</span>
            <span className="ml-1">{trend.value}%</span>
            <span className="ml-1">{trend.isPositive ? 'increase' : 'decrease'}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StatsCard;
