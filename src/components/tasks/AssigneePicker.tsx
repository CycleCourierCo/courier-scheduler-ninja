import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, ChevronDown } from "lucide-react";
import type { InternalUser } from "@/types/task";

export interface PickerOption {
  value: string;
  label: string;
}

interface Props {
  id: string;
  value: string;
  onChange: (value: string) => void;
  users: InternalUser[];
  /** Fixed choices shown before the people list (e.g. Anyone, Mine, Unassigned). */
  fixedOptions: PickerOption[];
  ariaLabel?: string;
  /** Open the list over the content below (for filter bars) instead of pushing it down. */
  floating?: boolean;
}

/**
 * Touch-friendly person picker. The list opens directly under the button in
 * normal page flow (no floating layer), so it can't be clipped off-screen or
 * trapped by dialog scroll locks on phones.
 */
const AssigneePicker: React.FC<Props> = ({ id, value, onChange, users, fixedOptions, ariaLabel, floating = false }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const userLabel = (u: InternalUser) => u.name || u.email || "Unnamed";
  const selectedLabel =
    fixedOptions.find(o => o.value === value)?.label ??
    (users.find(u => u.id === value) ? userLabel(users.find(u => u.id === value)!) : fixedOptions[0]?.label ?? "Choose");

  const term = search.trim().toLowerCase();
  const filteredUsers = useMemo(
    () => users.filter(u => userLabel(u).toLowerCase().includes(term) || (u.email || "").toLowerCase().includes(term)),
    [users, term],
  );

  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
    setSearch("");
  };

  return (
    <div className={`min-w-0 ${floating ? "relative" : ""}`}>
      <Button
        id={id}
        type="button"
        variant="outline"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={`${id}-options`}
        className="w-full justify-between px-3 font-normal"
        onClick={() => setOpen(o => !o)}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className={`ml-2 h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>
      {open && (
        <div id={`${id}-options`} className={`mt-1 min-w-0 space-y-2 rounded-md border bg-popover p-2 shadow-sm ${floating ? "absolute left-0 top-full z-40 w-[min(20rem,calc(100vw-1.5rem))]" : ""}`}>
          <Input
            aria-label="Search people"
            placeholder="Search names…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="text-base"
          />
          <div className="max-h-60 overflow-y-auto overscroll-contain touch-pan-y" role="listbox" aria-label="People">
            {!term && fixedOptions.map(o => (
              <Button key={o.value || "__none"} type="button" variant="ghost" role="option" aria-selected={value === o.value}
                className="h-11 w-full justify-start gap-2" onClick={() => choose(o.value)}>
                <Check className={`h-4 w-4 shrink-0 ${value === o.value ? "" : "invisible"}`} />
                <span className="truncate">{o.label}</span>
              </Button>
            ))}
            {filteredUsers.map(u => (
              <Button key={u.id} type="button" variant="ghost" role="option" aria-selected={value === u.id}
                className="h-11 w-full justify-start gap-2" onClick={() => choose(u.id)}>
                <Check className={`h-4 w-4 shrink-0 ${value === u.id ? "" : "invisible"}`} />
                <span className="truncate">{userLabel(u)}</span>
              </Button>
            ))}
            {term && filteredUsers.length === 0 && <p className="p-2 text-sm text-muted-foreground">No matching people</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default AssigneePicker;
