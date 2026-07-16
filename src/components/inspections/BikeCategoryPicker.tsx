import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { listFilterOptions } from "@/services/labourTimesService";

interface Props {
  value?: string | null;
  onChange: (v: string) => void;
  disabled?: boolean;
  buttonClassName?: string;
  placeholder?: string;
}

export function BikeCategoryPicker({ value, onChange, disabled, buttonClassName, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data } = useQuery({
    queryKey: ["labour_times_filter_options"],
    queryFn: listFilterOptions,
    staleTime: 10 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    const list = data?.bikeTypes ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((v) => v.toLowerCase().includes(q));
  }, [data, search]);

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn("w-full justify-between font-normal", buttonClassName)}
        >
          <span className="truncate">{value || placeholder || "Choose bike category…"}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[300px] max-w-[92vw]" align="start">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="h-8 pl-7 text-sm"
            />
          </div>
        </div>
        <ScrollArea className="h-64">
          {filtered.length === 0 && <p className="p-3 text-xs text-muted-foreground">No matches.</p>}
          {filtered.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                onChange(v);
                setOpen(false);
              }}
              className={cn(
                "w-full text-left px-3 py-1.5 text-sm hover:bg-accent border-b last:border-b-0 flex items-center gap-2",
                v === value && "bg-accent"
              )}
            >
              {v === value ? <Check className="h-3 w-3 text-primary" /> : <span className="w-3" />}
              {v}
            </button>
          ))}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
