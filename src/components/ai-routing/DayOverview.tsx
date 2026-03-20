import React from "react";
import { MapPin, Route, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DayOverviewProps {
  day: string;
  totalStops: number;
  routeCount: number;
  estimatedMiles?: number;
  unassignedCount?: number;
  onOptimizeAll: () => void;
  isOptimizing?: boolean;
}

const DayOverview: React.FC<DayOverviewProps> = ({
  day,
  totalStops,
  routeCount,
  estimatedMiles,
  unassignedCount = 0,
  onOptimizeAll,
  isOptimizing,
}) => {
  const formattedDate = new Date(day + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-lg bg-muted/50 border border-border/50">
      <div className="flex items-center gap-6">
        <h3 className="text-lg font-semibold">{formattedDate}</h3>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {totalStops} stops
          </span>
          <span className="flex items-center gap-1">
            <Route className="h-3.5 w-3.5" />
            {routeCount} routes
          </span>
          {estimatedMiles !== undefined && (
            <span>~{estimatedMiles.toFixed(0)} miles</span>
          )}
          {unassignedCount > 0 && (
            <span className="text-destructive font-medium">
              {unassignedCount} unassigned
            </span>
          )}
        </div>
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={onOptimizeAll}
        disabled={isOptimizing}
        className="gap-1"
      >
        <Zap className="h-3.5 w-3.5" />
        {isOptimizing ? 'Optimizing...' : 'Optimize All Routes'}
      </Button>
    </div>
  );
};

export default DayOverview;
