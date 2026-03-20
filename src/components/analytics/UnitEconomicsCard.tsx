import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { calculateUnitEconomics, UnitEconomicsMetrics } from "@/services/profitabilityService";
import { Timeslip } from "@/types/timeslip";
import { cn } from "@/lib/utils";
import { BarChart3, Route, Users, Clock } from "lucide-react";

interface PeriodData {
  timeslips: Timeslip[];
  revenue: number;
  costs: number;
  profit: number;
  label: string;
}

interface UnitEconomicsCardProps {
  dayData: PeriodData;
  weekData: PeriodData;
  monthData: PeriodData;
  yearData: PeriodData;
}

const MetricCell = ({ label, value, prefix = "£", colored = false }: {
  label: string;
  value: number;
  prefix?: string;
  colored?: boolean;
}) => (
  <div className="rounded-lg border bg-card p-3 space-y-1">
    <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
    <p className={cn(
      "text-lg font-bold tabular-nums",
      colored && value > 0 && "text-green-600",
      colored && value < 0 && "text-red-600"
    )}>
      {prefix}{value.toFixed(2)}
    </p>
  </div>
);

const MetricsGrid = ({ metrics }: { metrics: UnitEconomicsMetrics }) => (
  <div className="space-y-4">
    {/* Summary context */}
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      <span>{metrics.totalStops} stops</span>
      <span>{metrics.totalMiles.toFixed(0)} miles</span>
      <span>{metrics.driverDays} driver-days</span>
      <span>{metrics.totalHours.toFixed(1)} hours</span>
    </div>

    {/* Per Stop */}
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
        <h4 className="text-sm font-medium text-muted-foreground">Per Stop</h4>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <MetricCell label="Revenue" value={metrics.revenuePerStop} />
        <MetricCell label="Cost" value={metrics.costPerStop} />
        <MetricCell label="Profit" value={metrics.profitPerStop} colored />
      </div>
    </div>

    {/* Per Mile */}
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Route className="h-3.5 w-3.5 text-muted-foreground" />
        <h4 className="text-sm font-medium text-muted-foreground">Per Mile</h4>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <MetricCell label="Revenue" value={metrics.revenuePerMile} />
        <MetricCell label="Cost" value={metrics.costPerMile} />
        <MetricCell label="Profit" value={metrics.profitPerMile} colored />
      </div>
    </div>

    {/* Per Driver-Day */}
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Users className="h-3.5 w-3.5 text-muted-foreground" />
        <h4 className="text-sm font-medium text-muted-foreground">Per Driver-Day</h4>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <MetricCell label="Revenue" value={metrics.revenuePerDriverDay} />
        <MetricCell label="Cost" value={metrics.costPerDriverDay} />
        <MetricCell label="Profit" value={metrics.profitPerDriverDay} colored />
      </div>
    </div>

    {/* Per Hour */}
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        <h4 className="text-sm font-medium text-muted-foreground">Per Hour</h4>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <MetricCell label="Revenue / Hour" value={metrics.revenuePerHour} />
      </div>
    </div>
  </div>
);

const UnitEconomicsCard = ({ dayData, weekData, monthData, yearData }: UnitEconomicsCardProps) => {
  const [tab, setTab] = useState("week");

  const periods = useMemo(() => ({
    day: calculateUnitEconomics(dayData.timeslips, dayData.revenue, dayData.costs, dayData.profit),
    week: calculateUnitEconomics(weekData.timeslips, weekData.revenue, weekData.costs, weekData.profit),
    month: calculateUnitEconomics(monthData.timeslips, monthData.revenue, monthData.costs, monthData.profit),
    year: calculateUnitEconomics(yearData.timeslips, yearData.revenue, yearData.costs, yearData.profit),
  }), [dayData, weekData, monthData, yearData]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Unit Economics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="day" className="flex-1">{dayData.label}</TabsTrigger>
            <TabsTrigger value="week" className="flex-1">{weekData.label}</TabsTrigger>
            <TabsTrigger value="month" className="flex-1">{monthData.label}</TabsTrigger>
            <TabsTrigger value="year" className="flex-1">{yearData.label}</TabsTrigger>
          </TabsList>
          <TabsContent value="day"><MetricsGrid metrics={periods.day} /></TabsContent>
          <TabsContent value="week"><MetricsGrid metrics={periods.week} /></TabsContent>
          <TabsContent value="month"><MetricsGrid metrics={periods.month} /></TabsContent>
          <TabsContent value="year"><MetricsGrid metrics={periods.year} /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default UnitEconomicsCard;
