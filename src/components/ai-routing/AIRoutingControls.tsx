import React from "react";
import { Calendar, RefreshCw, Sparkles, GitCompareArrows } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface AIRoutingControlsProps {
  dateStart: string;
  dateEnd: string;
  driverCount: number;
  includeNoDates: boolean;
  planningMode: 'v1' | 'v2';
  onDateStartChange: (val: string) => void;
  onDateEndChange: (val: string) => void;
  onDriverCountChange: (val: number) => void;
  onIncludeNoDatesChange: (val: boolean) => void;
  onPlanningModeChange: (val: 'v1' | 'v2') => void;
  onRefreshPatterns: () => void;
  onGeneratePlan: () => void;
  onCompare: (driverCount: number) => void;
  isGenerating: boolean;
  isRefreshing: boolean;
  patternsLastUpdated?: string;
}

const AIRoutingControls: React.FC<AIRoutingControlsProps> = ({
  dateStart,
  dateEnd,
  driverCount,
  includeNoDates,
  onDateStartChange,
  onDateEndChange,
  onDriverCountChange,
  onIncludeNoDatesChange,
  onRefreshPatterns,
  onGeneratePlan,
  onCompare,
  isGenerating,
  isRefreshing,
  patternsLastUpdated,
}) => {
  return (
    <div className="space-y-4 p-4 rounded-lg bg-card border border-border">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="date-start" className="text-xs">Start Date</Label>
          <Input
            id="date-start"
            type="date"
            value={dateStart}
            onChange={(e) => onDateStartChange(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="date-end" className="text-xs">End Date</Label>
          <Input
            id="date-end"
            type="date"
            value={dateEnd}
            onChange={(e) => onDateEndChange(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="driver-count" className="text-xs">Drivers</Label>
          <Input
            id="driver-count"
            type="number"
            min={1}
            max={6}
            value={driverCount}
            onChange={(e) => onDriverCountChange(Math.max(1, Math.min(6, parseInt(e.target.value) || 1)))}
            className="w-20"
          />
        </div>
        <div className="flex items-center gap-2 pb-0.5">
          <Switch
            id="include-no-dates"
            checked={includeNoDates}
            onCheckedChange={onIncludeNoDatesChange}
          />
          <Label htmlFor="include-no-dates" className="text-xs cursor-pointer">
            Include jobs without dates
          </Label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onRefreshPatterns}
          disabled={isRefreshing}
          className="gap-1"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh Patterns'}
        </Button>
        {patternsLastUpdated && (
          <span className="text-xs text-muted-foreground">
            Last updated: {new Date(patternsLastUpdated).toLocaleDateString('en-GB')}
          </span>
        )}

        <div className="flex-1" />

        <Button
          variant="default"
          onClick={onGeneratePlan}
          disabled={isGenerating}
          className="gap-1"
        >
          <Sparkles className={`h-4 w-4 ${isGenerating ? 'animate-pulse' : ''}`} />
          {isGenerating ? 'Generating...' : 'Generate AI Plan'}
        </Button>

        {[2, 3, 4].filter(n => n !== driverCount).slice(0, 2).map(n => (
          <Button
            key={n}
            variant="outline"
            size="sm"
            onClick={() => onCompare(n)}
            disabled={isGenerating}
            className="gap-1"
          >
            <GitCompareArrows className="h-3.5 w-3.5" />
            Compare {n} drivers
          </Button>
        ))}
      </div>
    </div>
  );
};

export default AIRoutingControls;
