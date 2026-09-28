import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ABSENCE_LABELS, AbsenceRequest, AbsenceType, computeAllowance, createRequest, errorText,
  fmtDay, getMyRequests, londonToday, notifyAbsence, updateRequest,
} from "@/services/driverRotaService";

export const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" =>
  s === "approved" ? "default" : s === "declined" ? "destructive" : s === "pending" ? "secondary" : "outline";

const DriverHolidayRequests = () => {
  const { user, userProfile } = useAuth();
  const qc = useQueryClient();
  const today = londonToday();
  const [type, setType] = useState<AbsenceType>("holiday");
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const inactive = userProfile?.is_active === false;

  const { data: requests = [] } = useQuery({
    queryKey: ["my-absences", user?.id],
    queryFn: () => getMyRequests(user!.id),
    enabled: !!user,
  });
  const { data: allowance } = useQuery({
    queryKey: ["my-allowance", user?.id, requests.length, requests.map((r) => r.status).join()],
    queryFn: () => computeAllowance({
      id: user!.id,
      annual_leave_days: Number(userProfile?.annual_leave_days ?? 28),
      leave_year_start: userProfile?.leave_year_start || "01-01",
    }, requests),
    enabled: !!user && !!userProfile,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["my-absences"] });

  const submit = async () => {
    if (!user) return;
    if (end < start) { toast.error("End date must be on or after the start date"); return; }
    setSaving(true);
    try {
      const r = await createRequest({ driver_id: user.id, type, start_date: start, end_date: end, note });
      notifyAbsence(r.id, "submitted");
      toast.success("Request sent for approval");
      setNote("");
      refresh();
    } catch (e) { toast.error(errorText(e)); } finally { setSaving(false); }
  };

  const cancel = async (r: AbsenceRequest) => {
    try {
      if (r.status === "pending") { await updateRequest(r.id, { status: "cancelled" }); toast.success("Request cancelled"); }
      else { await updateRequest(r.id, { cancel_requested: true }); notifyAbsence(r.id, "cancel_requested"); toast.success("Cancellation requested — an admin will confirm"); }
      refresh();
    } catch (e) { toast.error(errorText(e)); }
  };

  if (inactive) {
    return <Layout><div className="container mx-auto px-4 py-10"><Card><CardContent className="p-6">Your account is inactive, so you can't request time off.</CardContent></Card></div></Layout>;
  }

  return (
    <Layout>
      <div className="container mx-auto max-w-3xl space-y-6 px-4 py-6">
        <div>
          <h1 className="text-3xl font-bold">My holidays</h1>
          <p className="text-muted-foreground">Request time off and track your allowance.</p>
        </div>

        {allowance && (
          <div className="grid grid-cols-3 gap-3">
            {[["Allowance", allowance.entitlement], ["Used", allowance.used], ["Remaining", allowance.remaining]].map(([l, v]) => (
              <Card key={l as string}><CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{l}</p>
                <p className="text-2xl font-bold tabular-nums">{v}</p>
              </CardContent></Card>
            ))}
            <p className="col-span-3 text-xs text-muted-foreground">
              Leave year {fmtDay(allowance.from, { day: "numeric", month: "short", year: "numeric" })} – {fmtDay(allowance.to, { day: "numeric", month: "short", year: "numeric" })}
              {allowance.pending > 0 && ` · ${allowance.pending} day(s) awaiting approval`}. Only your normal working days count; bank holidays are excluded.
            </p>
          </div>
        )}

        <Card>
          <CardHeader><CardTitle>New request</CardTitle><CardDescription>Full days only.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as AbsenceType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="holiday">Holiday</SelectItem>
                    <SelectItem value="unpaid">Unpaid leave</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>First day off</Label><Input type="date" value={start} min={today} onChange={(e) => { setStart(e.target.value); if (e.target.value > end) setEnd(e.target.value); }} /></div>
              <div className="space-y-2"><Label>Last day off</Label><Input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} /></div>
            </div>
            <div className="space-y-2">
              <Label>Note <span className="text-xs text-muted-foreground">(Visible to admins only)</span></Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} />
            </div>
            <Button onClick={submit} disabled={saving}>{saving ? "Sending…" : "Send request"}</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Your requests</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {!requests.length && <p className="text-sm text-muted-foreground">No requests yet.</p>}
            {requests.map((r) => (
              <div key={r.id} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{fmtDay(r.start_date)}{r.end_date !== r.start_date && ` – ${fmtDay(r.end_date)}`}</p>
                  <p className="text-sm text-muted-foreground">
                    {ABSENCE_LABELS[r.type]}{r.decision_reason ? ` · ${r.decision_reason}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariant(r.status)} className="capitalize">{r.status}</Badge>
                  {r.cancel_requested && r.status === "approved" && <Badge variant="outline">Cancellation requested</Badge>}
                  {r.status === "pending" && <Button size="sm" variant="outline" onClick={() => cancel(r)}>Cancel</Button>}
                  {r.status === "approved" && !r.cancel_requested && r.end_date >= today && (
                    <Button size="sm" variant="outline" onClick={() => cancel(r)}>Ask to cancel</Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default DriverHolidayRequests;
