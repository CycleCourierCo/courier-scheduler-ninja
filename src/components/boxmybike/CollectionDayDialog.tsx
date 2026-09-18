import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { fetchHolidayDates } from "@/services/holidayService";

/** YYYY-MM-DD in Europe/London terms for a plain date string or Date. */
export function toDayValue(value?: string | string[] | Date | Date[] | null): string {
  const first = Array.isArray(value) ? value[0] : value;
  if (!first) return "";
  if (first instanceof Date) {
    if (Number.isNaN(first.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${first.getFullYear()}-${pad(first.getMonth() + 1)}-${pad(first.getDate())}`;
  }
  return String(first).slice(0, 10);
}

export function formatCollectionDay(value?: string | string[] | Date | Date[] | null): string | null {
  const day = toDayValue(value);
  if (!day) return null;
  const d = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  });
}

const todayDay = () => toDayValue(new Date());

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing collection day, if one is already set. */
  initial?: string | string[] | Date | Date[] | null;
  saving?: boolean;
  onConfirm: (day: string) => void;
}

/**
 * Staff picker for the single inbound Northern Ireland collection day.
 * Monday to Friday only, no holidays and no past dates — matching the rules
 * the customer's own availability link enforces.
 */
const CollectionDayDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  initial,
  saving,
  onConfirm,
}) => {
  const [value, setValue] = React.useState<string>("");
  const [holidays, setHolidays] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (open) setValue(toDayValue(initial));
  }, [open, initial]);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchHolidayDates()
      .then((d) => {
        if (!cancelled) setHolidays(d);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open]);

  const confirm = () => {
    if (!value) {
      toast.error("Please choose a collection day");
      return;
    }
    if (value < todayDay()) {
      toast.error("The collection day can't be in the past");
      return;
    }
    const d = new Date(`${value}T12:00:00Z`);
    const weekday = d.getUTCDay();
    if (weekday === 0 || weekday === 6) {
      toast.error("Collections in Northern Ireland run Monday to Friday only");
      return;
    }
    if (holidays.includes(value)) {
      toast.error("That day is a holiday — please choose another weekday");
      return;
    }
    onConfirm(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Collection day in Northern Ireland</DialogTitle>
          <DialogDescription>
            Monday to Friday only. Saving emails City Air Express straight away with this day.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="ni-collection-day">Collection day</Label>
          <Input
            id="ni-collection-day"
            type="date"
            min={todayDay()}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          {formatCollectionDay(value) && (
            <p className="text-xs text-muted-foreground">{formatCollectionDay(value)}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={saving}>
            {saving ? "Saving…" : "Save and email partner"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CollectionDayDialog;
