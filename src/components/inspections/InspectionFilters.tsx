import React from "react";
import { format } from "date-fns";
import { CalendarIcon, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type DatePreset = "all" | "7d" | "30d" | "month" | "custom";

export interface InspectionFilterState {
  datePreset: DatePreset;
  from?: Date;
  to?: Date;
  customer: string;
  inspector: string;
  repairer: string;
  bikeType: string;
  billing: string;
}

export const EMPTY_INSPECTION_FILTERS: InspectionFilterState = {
  datePreset: "all",
  from: undefined,
  to: undefined,
  customer: "all",
  inspector: "all",
  repairer: "all",
  bikeType: "all",
  billing: "all",
};

export interface InspectionFilterOptions {
  customers: string[];
  inspectors: string[];
  repairers: string[];
  bikeTypes: string[];
}

const DATE_LABELS: Record<DatePreset, string> = {
  all: "Any date",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  month: "This month",
  custom: "Custom range",
};

export const countActiveInspectionFilters = (f: InspectionFilterState) =>
  [
    f.datePreset !== "all",
    f.customer !== "all",
    f.inspector !== "all",
    f.repairer !== "all",
    f.bikeType !== "all",
    f.billing !== "all",
  ].filter(Boolean).length;

interface Props {
  filters: InspectionFilterState;
  onChange: (next: InspectionFilterState) => void;
  options: InspectionFilterOptions;
  showBilling?: boolean;
}

const InspectionFilters: React.FC<Props> = ({ filters, onChange, options, showBilling }) => {
  const set = (patch: Partial<InspectionFilterState>) => onChange({ ...filters, ...patch });
  const activeCount = countActiveInspectionFilters(filters);

  const dropdown = (
    label: string,
    value: string,
    values: string[],
    key: keyof InspectionFilterState,
    anyLabel: string
  ) => (
    <div className="min-w-0 space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={(v) => set({ [key]: v } as Partial<InspectionFilterState>)}>
        <SelectTrigger className="h-9 w-full min-w-0 text-xs sm:w-[170px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{anyLabel}</SelectItem>
          {values.map((v) => (
            <SelectItem key={v} value={v}>
              <span className="block max-w-[220px] truncate">{v}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const dateControl = (
    <div className="min-w-0 space-y-1">
      <Label className="text-xs text-muted-foreground">Collected</Label>
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
        <Select
          value={filters.datePreset}
          onValueChange={(v) =>
            set({
              datePreset: v as DatePreset,
              ...(v === "custom" ? {} : { from: undefined, to: undefined }),
            })
          }
        >
          <SelectTrigger className="h-9 w-full min-w-0 text-xs sm:w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(DATE_LABELS) as DatePreset[]).map((k) => (
              <SelectItem key={k} value={k}>
                {DATE_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filters.datePreset === "custom" && (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {(["from", "to"] as const).map((side) => (
              <Popover key={side}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "h-9 min-w-0 justify-start text-xs font-normal",
                      !filters[side] && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-1 h-3.5 w-3.5" />
                    {filters[side] ? format(filters[side] as Date, "dd MMM yyyy") : side === "from" ? "From" : "To"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters[side]}
                    onSelect={(d) => set({ [side]: d } as Partial<InspectionFilterState>)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const controls = (
    <>
      {dateControl}
      {dropdown("Customer", filters.customer, options.customers, "customer", "All customers")}
      {dropdown("Inspected by", filters.inspector, options.inspectors, "inspector", "Any mechanic")}
      {dropdown("Repaired by", filters.repairer, options.repairers, "repairer", "Any mechanic")}
      {dropdown("Bike category", filters.bikeType, options.bikeTypes, "bikeType", "All categories")}
      {showBilling && (
        <div className="min-w-0 space-y-1">
          <Label className="text-xs text-muted-foreground">Billing</Label>
          <Select value={filters.billing} onValueChange={(v) => set({ billing: v })}>
            <SelectTrigger className="h-9 w-full min-w-0 text-xs sm:w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any billing state</SelectItem>
              <SelectItem value="invoiced">Invoiced</SelectItem>
              <SelectItem value="skipped">No invoice needed</SelectItem>
              <SelectItem value="unsettled">Not settled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </>
  );

  const chips: { label: string; clear: () => void }[] = [];
  if (filters.datePreset !== "all") {
    const label =
      filters.datePreset === "custom"
        ? `${filters.from ? format(filters.from, "dd MMM") : "…"} → ${filters.to ? format(filters.to, "dd MMM") : "…"}`
        : DATE_LABELS[filters.datePreset];
    chips.push({ label, clear: () => set({ datePreset: "all", from: undefined, to: undefined }) });
  }
  if (filters.customer !== "all") chips.push({ label: filters.customer, clear: () => set({ customer: "all" }) });
  if (filters.inspector !== "all")
    chips.push({ label: `Inspected: ${filters.inspector}`, clear: () => set({ inspector: "all" }) });
  if (filters.repairer !== "all")
    chips.push({ label: `Repaired: ${filters.repairer}`, clear: () => set({ repairer: "all" }) });
  if (filters.bikeType !== "all") chips.push({ label: filters.bikeType, clear: () => set({ bikeType: "all" }) });
  if (filters.billing !== "all")
    chips.push({
      label:
        filters.billing === "invoiced"
          ? "Invoiced"
          : filters.billing === "skipped"
          ? "No invoice needed"
          : "Not settled",
      clear: () => set({ billing: "all" }),
    });

  return (
    <div className="min-w-0 space-y-2">
      {/* Mobile: collapsed into a Filters button */}
      <div className="sm:hidden">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-start">
              <Filter className="mr-2 h-4 w-4" />
              Filters
              {activeCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {activeCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[min(320px,calc(100vw-2rem))] space-y-3">
            {controls}
          </PopoverContent>
        </Popover>
      </div>

      {/* Desktop: inline row */}
      <div className="hidden min-w-0 flex-wrap items-end gap-3 sm:flex">{controls}</div>

      {chips.length > 0 && (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {chips.map((c, idx) => (
            <Badge key={idx} variant="secondary" className="max-w-full gap-1">
              <span className="truncate">{c.label}</span>
              <button type="button" onClick={c.clear} aria-label={`Remove filter ${c.label}`}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onChange({ ...EMPTY_INSPECTION_FILTERS })}
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
};

export default InspectionFilters;
