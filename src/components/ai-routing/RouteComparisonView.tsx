import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, TrendingDown, TrendingUp, Equal } from "lucide-react";
import ValidationBadge from "./ValidationBadge";

interface ComparisonScenario {
  driverCount: number;
  totalStops: number;
  daysUsed: number;
  avgStopsPerRoute: number;
  validationPassed: boolean;
  fallbackUsed: boolean;
  validationErrors: string[];
  estimatedMiles?: number;
}

interface RouteComparisonViewProps {
  scenarios: ComparisonScenario[];
  onViewDetails: (driverCount: number) => void;
}

const RouteComparisonView: React.FC<RouteComparisonViewProps> = ({ scenarios, onViewDetails }) => {
  if (scenarios.length < 2) return null;

  const getComparisonIcon = (a: number, b: number) => {
    if (a < b) return <TrendingDown className="h-3.5 w-3.5 text-primary" />;
    if (a > b) return <TrendingUp className="h-3.5 w-3.5 text-destructive" />;
    return <Equal className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Plan Comparison</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {scenarios.map((scenario) => (
          <Card key={scenario.driverCount} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {scenario.driverCount} Driver{scenario.driverCount !== 1 ? 's' : ''}
                </CardTitle>
                <ValidationBadge
                  passed={scenario.validationPassed}
                  fallbackUsed={scenario.fallbackUsed}
                  errors={scenario.validationErrors}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Total Stops</p>
                  <p className="text-lg font-semibold">{scenario.totalStops}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Days Needed</p>
                  <p className="text-lg font-semibold">{scenario.daysUsed}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Avg Stops/Route</p>
                  <p className="text-lg font-semibold">{scenario.avgStopsPerRoute.toFixed(1)}</p>
                </div>
                {scenario.estimatedMiles !== undefined && (
                  <div>
                    <p className="text-xs text-muted-foreground">Est. Miles</p>
                    <p className="text-lg font-semibold">{scenario.estimatedMiles.toFixed(0)}</p>
                  </div>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1"
                onClick={() => onViewDetails(scenario.driverCount)}
              >
                View Full Plan
                <ArrowRight className="h-3 w-3" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default RouteComparisonView;
