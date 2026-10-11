import { format, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DatePickerProps {
  /** Date as a YYYY-MM-DD string, matching how the rota services store dates. */
  value: string;
  onChange: (value: string) => void;
  /** Earliest selectable date as a YYYY-MM-DD string. */
  min?: string;
  ariaLabel?: string;
  className?: string;
}

// Calendar picker for YYYY-MM-DD date fields — native <input type="date"> does
// not open a picker on every mobile browser, so we always show our own calendar.
export const DatePickerField = ({ value, onChange, min, ariaLabel, className }: DatePickerProps) => {
  const selected = value ? parseISO(value) : undefined;
  const minDate = min ? parseISO(min) : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label={ariaLabel}
          className={cn("w-full justify-start text-left font-normal", !value && "text-muted-foreground", className)}
        >
          <CalendarIcon className="h-4 w-4 shrink-0" />
          <span className="truncate">{value ? format(selected!, "EEE d MMM yyyy") : "Pick a date"}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" collisionPadding={8}>
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(day) => {
            if (day) onChange(format(day, "yyyy-MM-dd"));
          }}
          disabled={minDate ? [{ before: minDate }] : undefined}
          initialFocus
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
};
