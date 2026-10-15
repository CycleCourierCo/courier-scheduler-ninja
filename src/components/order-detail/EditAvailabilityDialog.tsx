import { useEffect, useState } from "react";
import { format, startOfDay } from "date-fns";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  side: "sender" | "receiver";
  currentDates: unknown;
  currentStatus?: string;
  onSaved: () => void | Promise<void>;
}

const toDate = (v: unknown): Date | null => {
  if (typeof v !== "string" && !(v instanceof Date)) return null;
  const s = typeof v === "string" ? v.slice(0, 10) : format(v, "yyyy-MM-dd");
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

const EditAvailabilityDialog = ({ open, onOpenChange, orderId, side, currentDates, currentStatus, onSaved }: Props) => {
  const [selected, setSelected] = useState<Date[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const arr = Array.isArray(currentDates) ? currentDates : [];
    setSelected(arr.map(toDate).filter((d): d is Date => !!d));
  }, [open, currentDates]);

  const today = startOfDay(new Date());

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const dates = [...new Set(selected.map((d) => format(d, "yyyy-MM-dd")))].sort();
      const now = new Date().toISOString();
      const update: Record<string, unknown> = { updated_at: now };
      if (side === "sender") {
        update.pickup_date = dates.length ? dates : null;
        update.sender_confirmed_at = dates.length ? now : null;
        if (dates.length && currentStatus === "sender_availability_pending") update.status = "sender_availability_confirmed";
      } else {
        update.delivery_date = dates.length ? dates : null;
        update.receiver_confirmed_at = dates.length ? now : null;
        if (dates.length && currentStatus === "receiver_availability_pending") update.status = "receiver_availability_confirmed";
      }
      const { error } = await supabase.from("orders").update(update as any).eq("id", orderId);
      if (error) throw error;

      const todayKey = format(today, "yyyy-MM-dd");
      if (dates.some((d) => d >= todayKey)) {
        await supabase.from("order_leg_availability").upsert(
          {
            order_id: orderId,
            leg_type: side === "sender" ? "collection" : "delivery",
            availability_status: "active",
            availability_expired_at: null,
            redate_requested_at: null,
          } as any,
          { onConflict: "order_id,leg_type" },
        );
      }

      toast.success(`${side === "sender" ? "Sender" : "Receiver"} dates saved`);
      await onSaved();
      onOpenChange(false);
    } catch (e) {
      console.error("Error saving availability dates:", e);
      toast.error("Couldn't save the dates. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-w-[min(100vw-1rem,26rem)] p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Edit {side === "sender" ? "sender (collection)" : "receiver (delivery)"} dates</DialogTitle>
          <DialogDescription>
            Tick the days the customer is available. Saving replaces their dates straight away — no email is sent.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center">
          <Calendar
            mode="multiple"
            selected={selected}
            onSelect={(d) => setSelected(d || [])}
            disabled={(d) => d < today}
            className="p-1 sm:p-3 pointer-events-auto"
            classNames={{ cell: "h-8 w-8 sm:h-9 sm:w-9 text-center text-sm p-0 relative", day: "h-8 w-8 sm:h-9 sm:w-9 p-0 font-normal rounded-md hover:bg-accent aria-selected:opacity-100", head_cell: "text-muted-foreground rounded-md w-8 sm:w-9 font-normal text-[0.8rem]" }}
          />
        </div>
        <p className="text-sm text-muted-foreground">{selected.length} date{selected.length === 1 ? "" : "s"} selected</p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>) : "Save dates"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditAvailabilityDialog;
