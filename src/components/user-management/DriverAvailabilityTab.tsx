import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DEFAULT_WORKING_DAYS, WEEKDAYS, computeAllowance, deleteOverride, errorText, fmtDay, getOverrides,
  getWeeklyAvailability, londonToday, addDays, saveLeaveSettings, saveWeeklyAvailability, upsertOverride,
} from "@/services/driverRotaService";

interface Props { userId: string }

type Row = { weekday: number; is_available: boolean; start_time: string; end_time: string };

export const DriverAvailabilityTab = ({ userId }: Props) => {
  const qc = useQueryClient();
  const today = londonToday();
  const [rows, setRows] = useState<Row[]>([]);
  const [leave, setLeave] = useState({ annual_leave_days: 28, leave_year_start: "01-01", depot_id: "none" });
  const [ov, setOv] = useState({ date: today, is_available: false, start_time: "", end_time: "", note: "" });
  const [saving, setSaving] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["driver-leave-profile", userId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("profiles")
        .select("id, annual_leave_days, leave_year_start, depot_id").eq("id", userId).maybeSingle();
      return data;
    },
  });
  const { data: weekly } = useQuery({ queryKey: ["dwa", userId], queryFn: () => getWeeklyAvailability([userId]) });
  const { data: overrides = [] } = useQuery({
    queryKey: ["dao", userId], queryFn: () => getOverrides(addDays(today, -30), addDays(today, 365), [userId]),
  });
  const { data: sites = [] } = useQuery({
    queryKey: ["rota-sites"],
    queryFn: async () => ((await (supabase as any).from("sites").select("id, name").order("name")).data || []) as { id: string; name: string }[],
  });
  const { data: allowance } = useQuery({
    queryKey: ["allowance", userId, profile?.annual_leave_days, profile?.leave_year_start],
    enabled: !!profile,
    queryFn: () => computeAllowance({ id: userId, annual_leave_days: Number(profile.annual_leave_days ?? 28), leave_year_start: profile.leave_year_start || "01-01" }),
  });

  useEffect(() => {
    if (!weekly) return;
    setRows(WEEKDAYS.map((_, i) => {
      const w = weekly.find((x) => x.weekday === i);
      return {
        weekday: i,
        is_available: w ? w.is_available : (!weekly.length && DEFAULT_WORKING_DAYS.includes(i)),
        start_time: w?.start_time?.slice(0, 5) || "", end_time: w?.end_time?.slice(0, 5) || "",
      };
    }));
  }, [weekly]);
  useEffect(() => {
    if (profile) setLeave({
      annual_leave_days: Number(profile.annual_leave_days ?? 28),
      leave_year_start: profile.leave_year_start || "01-01",
      depot_id: profile.depot_id || "none",
    });
  }, [profile]);

  const save = async () => {
    if (!/^\d{2}-\d{2}$/.test(leave.leave_year_start)) { toast.error("Leave year start must be MM-DD, e.g. 04-01"); return; }
    setSaving(true);
    try {
      await saveWeeklyAvailability(userId, rows.map((r) => ({ ...r, start_time: r.start_time || null, end_time: r.end_time || null })));
      await saveLeaveSettings(userId, {
        annual_leave_days: leave.annual_leave_days, leave_year_start: leave.leave_year_start,
        depot_id: leave.depot_id === "none" ? null : leave.depot_id,
      });
      toast.success("Availability saved");
      qc.invalidateQueries({ queryKey: ["dwa", userId] });
      qc.invalidateQueries({ queryKey: ["driver-leave-profile", userId] });
      qc.invalidateQueries({ queryKey: ["rota"] });
      qc.invalidateQueries({ queryKey: ["active-users"] });
    } catch (e) { toast.error(errorText(e)); } finally { setSaving(false); }
  };

  const addOverride = async () => {
    try {
      await upsertOverride({ driver_id: userId, date: ov.date, is_available: ov.is_available, start_time: ov.start_time || null, end_time: ov.end_time || null, note: ov.note || null });
      toast.success("Override saved");
      setOv({ ...ov, note: "" });
      qc.invalidateQueries({ queryKey: ["dao", userId] });
      qc.invalidateQueries({ queryKey: ["rota"] });
    } catch (e) { toast.error(errorText(e)); }
  };

  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.weekday === i ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h3 className="font-semibold">Weekly pattern</h3>
        <p className="text-xs text-muted-foreground">Leave times blank for all day.</p>
        {rows.map((r) => (
          <div key={r.weekday} className="grid grid-cols-[3rem_auto_1fr_1fr] items-center gap-2">
            <span className="text-sm font-medium">{WEEKDAYS[r.weekday]}</span>
            <Switch checked={r.is_available} onCheckedChange={(v) => setRow(r.weekday, { is_available: v })} aria-label={`Works ${WEEKDAYS[r.weekday]}`} />
            <Input type="time" value={r.start_time} disabled={!r.is_available} onChange={(e) => setRow(r.weekday, { start_time: e.target.value })} />
            <Input type="time" value={r.end_time} disabled={!r.is_available} onChange={(e) => setRow(r.weekday, { end_time: e.target.value })} />
          </div>
        ))}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1"><Label>Annual leave (days)</Label>
          <Input type="number" min={0} step={0.5} value={leave.annual_leave_days} onChange={(e) => setLeave({ ...leave, annual_leave_days: Number(e.target.value) })} /></div>
        <div className="space-y-1"><Label>Leave year starts (MM-DD)</Label>
          <Input value={leave.leave_year_start} onChange={(e) => setLeave({ ...leave, leave_year_start: e.target.value })} placeholder="01-01" /></div>
        <div className="space-y-1"><Label>Depot</Label>
          <Select value={leave.depot_id} onValueChange={(v) => setLeave({ ...leave, depot_id: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not set</SelectItem>
              {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select></div>
        {allowance && <p className="text-sm text-muted-foreground sm:col-span-3">This leave year: {allowance.used} used, {allowance.remaining} remaining{allowance.pending ? `, ${allowance.pending} pending` : ""}.</p>}
      </section>
      <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save availability"}</Button>

      <section className="space-y-2 border-t pt-4">
        <h3 className="font-semibold">One-off changes</h3>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr_1fr]">
          <Input type="date" value={ov.date} onChange={(e) => setOv({ ...ov, date: e.target.value })} />
          <label className="flex items-center gap-2 text-sm"><Switch checked={ov.is_available} onCheckedChange={(v) => setOv({ ...ov, is_available: v })} />Working</label>
          <Input type="time" value={ov.start_time} disabled={!ov.is_available} onChange={(e) => setOv({ ...ov, start_time: e.target.value })} />
          <Input type="time" value={ov.end_time} disabled={!ov.is_available} onChange={(e) => setOv({ ...ov, end_time: e.target.value })} />
        </div>
        <div className="flex gap-2">
          <Input placeholder="Note (optional)" value={ov.note} onChange={(e) => setOv({ ...ov, note: e.target.value })} />
          <Button variant="outline" onClick={addOverride}>Add</Button>
        </div>
        {overrides.map((o) => (
          <div key={o.id} className="flex items-center justify-between rounded border p-2 text-sm">
            <span>{fmtDay(o.date)} · {o.is_available ? `Working ${o.start_time ? `${o.start_time.slice(0, 5)}–${o.end_time?.slice(0, 5) ?? ""}` : "all day"}` : "Not working"}{o.note ? ` · ${o.note}` : ""}</span>
            <Button variant="ghost" size="icon" aria-label="Remove override" onClick={async () => { await deleteOverride(o.id!); qc.invalidateQueries({ queryKey: ["dao", userId] }); }}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </section>
    </div>
  );
};
