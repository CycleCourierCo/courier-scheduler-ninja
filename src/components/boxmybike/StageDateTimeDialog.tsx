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

/** ISO string -> value for <input type="datetime-local"> in local time. */
export function toLocalInputValue(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return toLocalInputValue(null);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/** Local datetime-local value -> ISO string. */
export function fromLocalInputValue(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function formatStageDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface StageDateTimeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Existing timestamp when editing; defaults to now when empty. */
  initial?: string | null;
  confirmLabel?: string;
  saving?: boolean;
  onConfirm: (isoTimestamp: string) => void;
}

const StageDateTimeDialog: React.FC<StageDateTimeDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  initial,
  confirmLabel = "Save",
  saving,
  onConfirm,
}) => {
  const [value, setValue] = React.useState(() => toLocalInputValue(initial));

  React.useEffect(() => {
    if (open) setValue(toLocalInputValue(initial));
  }, [open, initial]);

  const handleConfirm = () => {
    const iso = fromLocalInputValue(value);
    if (!iso) {
      toast.error("Enter a valid date and time");
      return;
    }
    if (new Date(iso).getTime() > Date.now() + 60 * 1000) {
      toast.error("That date and time is in the future");
      return;
    }
    onConfirm(iso);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="stage-datetime">Date and time</Label>
          <Input
            id="stage-datetime"
            type="datetime-local"
            value={value}
            max={toLocalInputValue(null)}
            onChange={(e) => setValue(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Defaults to now — change it if this happened earlier.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={saving}>
            {saving ? "Saving…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StageDateTimeDialog;
