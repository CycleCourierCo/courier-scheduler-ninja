import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, ChevronDown } from "lucide-react";

export interface InlinePickerOption {
  value: string;
  label: string;
}

interface Props {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: InlinePickerOption[];
  placeholder?: string;
  ariaLabel?: string;
  searchPlaceholder?: string;
  /** Show a search box once the list is longer than this. */
  searchThreshold?: number;
}

/**
 * Touch-friendly single-choice picker. The list opens in normal page flow
 * under the button (no floating layer), so it scrolls with a finger on phones
 * and isn't trapped by dialog scroll locks.
 */
export function InlinePicker({ id, value, onChange, options, placeholder = "Choose", ariaLabel, searchPlaceholder = "Search…", searchThreshold = 6 }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = options.find((o) => o.value === value);
  const term = search.trim().toLowerCase();
  const filtered = useMemo(() => options.filter((o) => o.label.toLowerCase().includes(term)), [options, term]);

  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
    setSearch("");
  };

  return (
    <div className="min-w-0">
      <Button id={id} type="button" variant="outline" aria-label={ariaLabel} aria-expanded={open} aria-controls={`${id}-options`}
        className="w-full justify-between px-3 font-normal" onClick={() => setOpen((o) => !o)}>
        <span className={`truncate ${selected ? "" : "text-muted-foreground"}`}>{selected?.label ?? placeholder}</span>
        <ChevronDown className={`ml-2 h-4 w-4 shrink-0 ${open ? "rotate-180" : ""}`} />
      </Button>
      {open && (
        <div id={`${id}-options`} className="mt-1 min-w-0 space-y-2 rounded-md border bg-popover p-2 shadow-sm">
          {options.length > searchThreshold && (
            <Input aria-label={searchPlaceholder} placeholder={searchPlaceholder} value={search} onChange={(e) => setSearch(e.target.value)} className="text-base" />
          )}
          <div className="max-h-60 overflow-y-auto overscroll-contain touch-pan-y" role="listbox" aria-label={ariaLabel}>
            {filtered.map((o) => (
              <Button key={o.value || "__none"} type="button" variant="ghost" role="option" aria-selected={value === o.value}
                className="h-11 w-full justify-start gap-2" onClick={() => choose(o.value)}>
                <Check className={`h-4 w-4 shrink-0 ${value === o.value ? "" : "invisible"}`} />
                <span className="truncate">{o.label}</span>
              </Button>
            ))}
            {filtered.length === 0 && <p className="p-2 text-sm text-muted-foreground">No matches</p>}
          </div>
        </div>
      )}
    </div>
  );
}
