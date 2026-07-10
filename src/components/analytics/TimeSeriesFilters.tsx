import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type { Granularity, TimeRange } from "@/services/analyticsService";

export interface TimeSeriesFiltersProps {
  range: TimeRange;
  granularity: Granularity;
  onRangeChange: (range: TimeRange) => void;
  onGranularityChange: (g: Granularity) => void;
  minDate?: Date;
}

const presetRange = (preset: "4w" | "8w" | "12w" | "6m" | "1y" | "all", minDate?: Date): TimeRange => {
  const end = new Date();
  const start = new Date();
  switch (preset) {
    case "4w": start.setDate(end.getDate() - 28); break;
    case "8w": start.setDate(end.getDate() - 56); break;
    case "12w": start.setDate(end.getDate() - 84); break;
    case "6m": start.setMonth(end.getMonth() - 6); break;
    case "1y": start.setFullYear(end.getFullYear() - 1); break;
    case "all": return { start: minDate ?? new Date(2020, 0, 1), end };
  }
  return { start, end };
};

const TimeSeriesFilters = ({
  range,
  granularity,
  onRangeChange,
  onGranularityChange,
  minDate,
}: TimeSeriesFiltersProps) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Mobile: dropdown */}
      <select
        className="sm:hidden h-7 rounded-md border bg-background px-2 text-xs"
        onChange={(e) => {
          const v = e.target.value as "4w" | "8w" | "12w" | "6m" | "1y" | "all";
          if (v) onRangeChange(presetRange(v, minDate));
        }}
        defaultValue=""
      >
        <option value="" disabled>Quick range…</option>
        <option value="4w">Last 4 weeks</option>
        <option value="8w">Last 8 weeks</option>
        <option value="12w">Last 12 weeks</option>
        <option value="6m">Last 6 months</option>
        <option value="1y">Last year</option>
        <option value="all">All time</option>
      </select>

      {/* Desktop: pill buttons */}
      <div className="hidden sm:flex flex-wrap gap-1">
        {(["4w", "8w", "12w", "6m", "1y", "all"] as const).map(p => (
          <Button
            key={p}
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={() => onRangeChange(presetRange(p, minDate))}
          >
            {p === "all" ? "All" : p}
          </Button>
        ))}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn("h-7 justify-start text-left font-normal text-xs px-2")}
          >
            <CalendarIcon className="mr-1 h-3 w-3" />
            {format(range.start, "d MMM yy")} – {format(range.end, "d MMM yy")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            selected={{ from: range.start, to: range.end }}
            onSelect={(r) => {
              if (r?.from && r?.to) {
                onRangeChange({ start: r.from, end: r.to });
              }
            }}
            numberOfMonths={2}
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>

      <ToggleGroup
        type="single"
        size="sm"
        value={granularity}
        onValueChange={(v) => v && onGranularityChange(v as Granularity)}
        className="gap-0 border rounded-md"
      >
        <ToggleGroupItem value="day" className="h-7 px-2 text-xs rounded-none rounded-l-md">Day</ToggleGroupItem>
        <ToggleGroupItem value="week" className="h-7 px-2 text-xs rounded-none">Week</ToggleGroupItem>
        <ToggleGroupItem value="month" className="h-7 px-2 text-xs rounded-none rounded-r-md">Month</ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
};

export default TimeSeriesFilters;
