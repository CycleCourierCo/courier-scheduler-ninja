import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CalendarPlus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActiveUsers } from "@/hooks/useActiveUsers";
import {
  ABSENCE_LABELS, AbsenceRequest, eachDay, errorText, fmtDay, getAllRequests, getBankHolidaySet,
  getMinDrivers, getOverrides, getWeeklyAvailability, leaveYear, countLeaveDays, londonToday,
  notifyAbsence, resolveDay, setMinDrivers, updateRequest,
} from "@/services/driverRotaService";
import { LogAbsenceDialog } from "./LogAbsenceDialog";

export const AbsenceApprovalsCard = () => {
  const qc = useQueryClient();
  const today = londonToday();
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [logOpen, setLogOpen] = useState(false);
  const { data: drivers = [] } = useActiveUsers("driver");
  const byId = new Map(drivers.map((d) => [d.id, d]));

  const { data, refetch } = useQuery({
    queryKey: ["absence-approvals", drivers.length],
    enabled: drivers.length > 0,
    queryFn: async () => {
      const ids = drivers.map((d) => d.id);
      const all = await getAllRequests({ from: `${Number(today.slice(0, 4)) - 1}-01-01` });
      const [weekly, overrides, bank, min] = await Promise.all([
        getWeeklyAvailability(ids), getOverrides(`${Number(today.slice(0, 4)) - 1}-01-01`, `${Number(today.slice(0, 4)) + 2}-12-31`, ids),
        getBankHolidaySet(), getMinDrivers(),
      ]);
      return { all, weekly, overrides, bank, min };
    },
  });
  const [minInput, setMinInput] = useState<string>("");

  const activeIds = new Set(drivers.map((d) => d.id));
  const queue = (data?.all || []).filter((r) => activeIds.has(r.driver_id) && (r.status === "pending" || (r.status === "approved" && r.cancel_requested)));

  const coverInfo = (r: AbsenceRequest) => {
    if (!data) return { othersOff: 0, lowest: 0, lowDays: [] as string[] };
    const days = eachDay(r.start_date, r.end_date);
    const others = new Set<string>();
    const lowDays: string[] = [];
    let lowest = Infinity;
    for (const d of days) {
      const off = new Set(data.all.filter((a) => a.driver_id !== r.driver_id && a.status === "approved" && a.start_date <= d && a.end_date >= d).map((a) => a.driver_id));
      off.forEach((id) => others.add(id));
      if (data.bank.has(d)) continue;
      const working = drivers.filter((drv) => drv.id !== r.driver_id && !off.has(drv.id) && resolveDay(drv.id, d, data.weekly, data.overrides).works).length;
      lowest = Math.min(lowest, working);
      if (working < data.min) lowDays.push(d);
    }
    return { othersOff: others.size, lowest: lowest === Infinity ? 0 : lowest, lowDays };
  };

  const allowanceFor = (driverId: string) => {
    const drv = byId.get(driverId); if (!drv || !data) return null;
    const { from, to } = leaveYear(drv.leave_year_start);
    const used = data.all.filter((a) => a.driver_id === driverId && a.type === "holiday" && a.status === "approved")
      .reduce((n, a) => n + countLeaveDays(a, data.weekly, data.overrides, data.bank, from, to), 0);
    return { used, remaining: drv.annual_leave_days - used };
  };

  const act = async (r: AbsenceRequest, status: "approved" | "declined" | "cancelled") => {
    try {
      await updateRequest(r.id, { status, decision_reason: reasons[r.id]?.trim() || null });
      notifyAbsence(r.id, "decided");
      toast.success(status === "approved" ? "Approved" : status === "declined" ? "Declined" : "Leave cancelled");
      qc.invalidateQueries({ queryKey: ["absence-pending-count"] });
      qc.invalidateQueries({ queryKey: ["rota"] });
      refetch();
    } catch (e) { toast.error(errorText(e)); }
  };

  const upcomingApproved = (data?.all || []).filter((r) => activeIds.has(r.driver_id) && r.status === "approved" && !r.cancel_requested && r.end_date >= today);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">Driver absence approvals {queue.length > 0 && <Badge variant="destructive">{queue.length}</Badge>}</CardTitle>
          <CardDescription>Approve holiday requests and log sickness or other absence.</CardDescription>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Min drivers per day</Label>
            <div className="flex gap-1">
              <Input className="w-20" type="number" min={0} placeholder={String(data?.min ?? 3)} value={minInput} onChange={(e) => setMinInput(e.target.value)} />
              <Button variant="outline" size="sm" disabled={minInput === ""} onClick={async () => {
                try { await setMinDrivers(Number(minInput)); setMinInput(""); refetch(); toast.success("Minimum saved"); } catch (e) { toast.error(errorText(e)); }
              }}>Save</Button>
            </div>
          </div>
          <Button onClick={() => setLogOpen(true)}><CalendarPlus className="mr-2 h-4 w-4" />Log absence</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!queue.length && <p className="text-sm text-muted-foreground">Nothing waiting for a decision.</p>}
        {queue.map((r) => {
          const drv = byId.get(r.driver_id); const cover = coverInfo(r); const al = allowanceFor(r.driver_id);
          return (
            <div key={r.id} className="space-y-2 rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{drv?.name || drv?.email} · {ABSENCE_LABELS[r.type]}</p>
                  <p className="text-sm text-muted-foreground">{fmtDay(r.start_date)}{r.end_date !== r.start_date && ` – ${fmtDay(r.end_date)}`}</p>
                </div>
                {r.cancel_requested ? <Badge variant="outline">Driver asked to cancel</Badge> : <Badge variant="secondary">Pending</Badge>}
              </div>
              {r.note && <p className="rounded bg-muted p-2 text-sm">{r.note}</p>}
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>{cover.othersOff} other driver(s) off on these dates</span>
                <span>Lowest cover if approved: {cover.lowest}</span>
                {al && <span>Allowance: {al.used} used, {al.remaining} remaining</span>}
              </div>
              {cover.lowDays.length > 0 && !r.cancel_requested && (
                <p className="flex items-center gap-1 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />
                  Cover drops below {data?.min} on {cover.lowDays.map((d) => fmtDay(d)).join(", ")}</p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input placeholder="Reason (optional, sent to driver)" value={reasons[r.id] || ""} onChange={(e) => setReasons({ ...reasons, [r.id]: e.target.value })} />
                {r.cancel_requested ? (
                  <Button onClick={() => act(r, "cancelled")}>Cancel leave</Button>
                ) : (<>
                  <Button onClick={() => act(r, "approved")}>Approve</Button>
                  <Button variant="outline" onClick={() => act(r, "declined")}>Decline</Button>
                </>)}
              </div>
            </div>
          );
        })}

        {upcomingApproved.length > 0 && (
          <details className="rounded-md border p-3">
            <summary className="cursor-pointer text-sm font-medium">Upcoming approved absence ({upcomingApproved.length})</summary>
            <div className="mt-2 space-y-2">
              {upcomingApproved.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-sm">
                  <span>{byId.get(r.driver_id)?.name} · {ABSENCE_LABELS[r.type]} · {fmtDay(r.start_date)}{r.end_date !== r.start_date && ` – ${fmtDay(r.end_date)}`}</span>
                  <Button size="sm" variant="ghost" onClick={() => act(r, "cancelled")}>Cancel</Button>
                </div>
              ))}
            </div>
          </details>
        )}
      </CardContent>
      <LogAbsenceDialog open={logOpen} onOpenChange={setLogOpen} drivers={drivers} onSaved={() => { refetch(); qc.invalidateQueries({ queryKey: ["rota"] }); }} />
    </Card>
  );
};
