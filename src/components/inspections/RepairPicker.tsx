import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, ShieldAlert, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

import { cn } from "@/lib/utils";
import { listLabourTimes, type LabourTimeRow } from "@/services/labourTimesService";
import { calculateLabourPrice, formatGBP, useWorkshopSettings } from "@/lib/labourPricing";

export interface RepairPickerSelection {
  repair_id: string;
  repair_name: string;
  labour_minutes: number;
  min_charge_gbp: number;
  labour_price_gbp: number;
  bike_type: string;
  category: string;
  subcategory: string;
}

interface Props {
  bikeType?: string | null;
  value?: string | null; // repair_id
  onSelect: (sel: RepairPickerSelection) => void;
  disabled?: boolean;
  placeholder?: string;
  buttonClassName?: string;
}

const truthy = (v: string | null | undefined) => {
  if (!v) return false;
  const s = String(v).trim().toLowerCase();
  return s === "yes" || s === "true" || s === "y" || s === "1";
};

export function RepairPicker({ bikeType, value, onSelect, disabled, placeholder, buttonClassName }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [rows, setRows] = useState<LabourTimeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const { data: settings } = useWorkshopSettings();
  const rate = settings?.hourly_rate_gbp ?? 75;
  const minCharge = settings?.min_charge_gbp ?? 15;
  const requestId = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 200);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!open) return;
    const id = ++requestId.current;
    setLoading(true);
    listLabourTimes({
      page: 1,
      pageSize: 30,
      bikeType: !showAll && bikeType ? bikeType : undefined,
      search: debounced.trim().length >= 2 ? debounced : undefined,
    })
      .then((res) => {
        if (id !== requestId.current) return;
        setRows(res.rows);
      })
      .catch((err) => {
        console.error("RepairPicker load failed", err);
        if (id === requestId.current) setRows([]);
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [open, debounced, bikeType, showAll]);

  const selectedLabel = useMemo(() => {
    if (!value) return null;
    const found = rows.find((r) => r.repair_id === value);
    return found?.repair_name ?? value;
  }, [value, rows]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn("w-full min-w-0 justify-between font-normal", buttonClassName)}
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            <Wrench className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{selectedLabel ?? placeholder ?? "Pick from repair catalogue…"}</span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[calc(100vw-1rem)] sm:w-[420px] sm:max-w-[92vw]" align="start">
        <div className="p-2 border-b space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search repair name or subcategory…"
              className="h-8 pl-7 text-sm"
            />
          </div>
          {bikeType && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              <span>
                Filtered by: <span className="font-medium text-foreground">{bikeType}</span> — show all bike types
              </span>
            </label>
          )}
          {!bikeType && (
            <p className="text-xs text-amber-600">No bike category set — showing all repairs.</p>
          )}
        </div>
        <div className="max-h-72 overflow-y-auto overscroll-contain">
          {loading && <p className="p-3 text-xs text-muted-foreground">Loading…</p>}
          {!loading && rows.length === 0 && (
            <p className="p-3 text-xs text-muted-foreground">No matching repairs.</p>
          )}
          {!loading &&
            rows.map((r) => {
              const price = calculateLabourPrice(r.labour_minutes, rate, Number(r.min_charge_gbp) || minCharge);
              const safety = truthy(r.safety_critical);
              const warranty = truthy(r.warranty_eligible);
              const torque = truthy(r.torque_check_required);
              const isSelected = value === r.repair_id;
              return (
                <button
                  key={r.repair_id}
                  type="button"
                  onClick={() => {
                    onSelect({
                      repair_id: r.repair_id,
                      repair_name: r.repair_name,
                      labour_minutes: r.labour_minutes,
                      min_charge_gbp: Number(r.min_charge_gbp) || minCharge,
                      labour_price_gbp: price,
                      bike_type: r.bike_type,
                      category: r.category,
                      subcategory: r.subcategory,
                    });
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2 hover:bg-accent border-b last:border-b-0",
                    isSelected && "bg-accent"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate flex items-center gap-1">
                        {isSelected && <Check className="h-3 w-3 text-primary" />}
                        {r.repair_name}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {r.bike_type} · {r.category} · {r.subcategory}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {safety && (
                          <Badge variant="destructive" className="h-4 px-1 text-[10px] gap-0.5">
                            <ShieldAlert className="h-2.5 w-2.5" /> Safety
                          </Badge>
                        )}
                        {warranty && (
                          <Badge variant="secondary" className="h-4 px-1 text-[10px]">Warranty</Badge>
                        )}
                        {torque && (
                          <Badge variant="outline" className="h-4 px-1 text-[10px]">Torque check</Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-semibold">{formatGBP(price)}</p>
                      <p className="text-[10px] text-muted-foreground">{r.labour_minutes} min</p>
                    </div>
                  </div>
                </button>
              );
            })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
