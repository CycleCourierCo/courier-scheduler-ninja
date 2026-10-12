import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AvailabilityOverride, deleteOverride, errorText, fmtDay, getOverrides, londonToday, upsertOverride,
} from "@/services/driverRotaService";

interface Props {
  driverId: string;
  /** Invalidate the rota query after changes (admins editing from the rota). */
  invalidateRota?: boolean;
}

const toKey = (d: Date) => format(d, "yyyy-MM-dd");

/**
 * Shared editor for the dates a driver can't work. Writes per-date
 * "not available" overrides — no approval, no allowance.
 */
export const UnavailableDatesEditor = ({ driverId, invalidateRota }: Props) => {
  const qc = useQueryClient();
  const today = londonToday();
  const [selected, setSelected] = useState<Date[]>([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: overrides = [], refetch } = useQuery({
    queryKey: ["unavailable-dates", driverId],
    enabled: !!driverId,
    queryFn: async () =>
      (await getOverrides(today, "2099-12-31", [driverId])).filter((o) => !o.is_available),
  });

  const refresh = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ["unavailable-dates"] });
    if (invalidateRota) qc.invalidateQueries({ queryKey: ["rota"] });
  };

  const existing = new Set(overrides.map((o) => o.date));

  const save = async () => {
    if (!selected.length) { toast.error("Pick at least one date on the calendar"); return; }
    setSaving(true);
    let added = 0, skipped = 0;
    for (const d of selected) {
      const date = toKey(d);
      if (existing.has(date)) { skipped++; continue; }
      try {
        await upsertOverride({ driver_id: driverId, date, is_available: false, start_time: null, end_time: null, note: note.trim() || null });
        added++;
      } catch { skipped++; }
    }
    if (added) toast.success(`Marked ${added} day${added > 1 ? "s" : ""} as unavailable`);
    if (skipped) toast.warning(`${skipped} date${skipped > 1 ? "s" : ""} already marked or failed`);
    setSelected([]); setNote(""); setSaving(false);
    refresh();
  };

  const remove = async (o: AvailabilityOverride) => {
    if (!o.id) return;
    try {
      await deleteOverride(o.id);
      toast.success("Date removed — you're available again");
      refresh();
    } catch (e) { toast.error(errorText(e)); }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="border rounded-md p-2 bg-background">
          <Calendar
            mode="multiple"
            selected={selected}
            onSelect={(dates) => setSelected(dates || [])}
            disabled={(date) => toKey(date) < today || existing.has(toKey(date))}
            modifiers={{ unavailable: overrides.map((o) => new Date(o.date + "T00:00:00")) }}
            modifiersClassNames={{ unavailable: "bg-destructive/20 text-destructive font-semibold" }}
            className="p-3 pointer-events-auto"
          />
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="unavailable-note">Note <span className="text-xs text-muted-foreground">(optional)</span></Label>
            <Input
              id="unavailable-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Holiday, appointment"
              maxLength={200}
            />
          </div>
          {selected.length > 0 && (
            <p className="text-sm text-muted-foreground">{selected.length} date{selected.length > 1 ? "s" : ""} selected</p>
          )}
          <Button onClick={save} disabled={saving || selected.length === 0} className="w-full">
            {saving ? "Saving…" : "Mark as unavailable"}
          </Button>
          <p className="text-xs text-muted-foreground">
            This takes effect straight away — no approval needed, and there's no limit on days.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Upcoming unavailable dates</p>
        {!overrides.length && <p className="text-sm text-muted-foreground">None — you're shown as available on your normal working days.</p>}
        {overrides.map((o) => (
          <div key={o.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
            <div>
              <span className="font-medium">{fmtDay(o.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>
              {o.note && <span className="ml-2 text-muted-foreground">· {o.note}</span>}
            </div>
            <Button size="sm" variant="ghost" onClick={() => remove(o)} aria-label={`Remove ${o.date}`}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};
