
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
    <Card className="hover-lift">
      <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6">
        <CardTitle className="text-xs sm:text-sm font-medium truncate pr-2">{title}</CardTitle>
        {Icon && <Icon className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />}
      </CardHeader>
      <CardContent className="p-3 sm:p-6 pt-0">
        <div className="text-lg sm:text-2xl font-bold truncate">{value}</div>
        {description && (
          <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-2">{description}</p>
        )}
        {trend && (
          <div className={`flex items-center text-[10px] sm:text-xs ${
            trend.isPositive ? 'text-primary' : 'text-destructive'
          }`}>
            <span>{trend.isPositive ? '↑' : '↓'}</span>
            <span className="ml-1">{trend.value}%</span>
            <span className="ml-1 hidden sm:inline">{trend.isPositive ? 'increase' : 'decrease'}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StatsCard;
