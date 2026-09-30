import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DriverAvailabilityTab } from "@/components/user-management/DriverAvailabilityTab";
import {
  ABSENCE_LABELS, AbsenceType, createRequest, errorText, fmtDay, getAllRequests, londonToday, notifyAbsence, updateRequest,
} from "@/services/driverRotaService";

interface Props {
  driver: { id: string; name?: string | null; email?: string | null } | null;
  onOpenChange: (o: boolean) => void;
}

export const DriverRotaEditDialog = ({ driver, onOpenChange }: Props) => {
  const qc = useQueryClient();
  const today = londonToday();
  const [type, setType] = useState<AbsenceType>("holiday");
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: absences = [], refetch } = useQuery({
    queryKey: ["rota-driver-absences", driver?.id],
    enabled: !!driver,
    queryFn: async () => (await getAllRequests({ statuses: ["pending", "approved"], from: today }))
      .filter((a) => a.driver_id === driver!.id),
  });

  const refresh = () => { refetch(); qc.invalidateQueries({ queryKey: ["rota"] }); };

  const add = async () => {
    if (!driver) return;
    if (end < start) { toast.error("End date must be on or after the start date"); return; }
    setSaving(true);
    try {
      const r = await createRequest({ driver_id: driver.id, type, start_date: start, end_date: end, note, status: "approved" });
      notifyAbsence(r.id, "decided");
      toast.success("Absence added");
      setNote(""); refresh();
    } catch (e) { toast.error(errorText(e)); } finally { setSaving(false); }
  };

  const cancel = async (id: string) => {
    try { await updateRequest(id, { status: "cancelled" }); toast.success("Absence cancelled"); refresh(); }
    catch (e) { toast.error(errorText(e)); }
  };

  return (
    <Dialog open={!!driver} onOpenChange={(o) => { if (!o) qc.invalidateQueries({ queryKey: ["rota"] }); onOpenChange(o); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{driver?.name || driver?.email}</DialogTitle></DialogHeader>
        {driver && (
          <Tabs defaultValue="weekly">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="weekly">Weekly availability</TabsTrigger>
              <TabsTrigger value="holidays">Holidays</TabsTrigger>
            </TabsList>
            <TabsContent value="weekly"><DriverAvailabilityTab userId={driver.id} /></TabsContent>
            <TabsContent value="holidays" className="space-y-4">
              <div className="space-y-3 rounded-md border p-3">
                <div className="space-y-1"><Label>Type</Label>
                  <Select value={type} onValueChange={(v) => setType(v as AbsenceType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="holiday">Holiday</SelectItem>
                      <SelectItem value="sick">Sick</SelectItem>
                      <SelectItem value="unpaid">Unpaid leave</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select></div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1"><Label>First day</Label><Input type="date" value={start} onChange={(e) => { setStart(e.target.value); if (e.target.value > end) setEnd(e.target.value); }} /></div>
                  <div className="space-y-1"><Label>Last day</Label><Input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} /></div>
                </div>
                <div className="space-y-1"><Label>Note <span className="text-xs text-muted-foreground">(admins only)</span></Label>
                  <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
                <Button onClick={add} disabled={saving}>{saving ? "Saving…" : "Add (approved)"}</Button>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Upcoming</p>
                {!absences.length && <p className="text-sm text-muted-foreground">None booked.</p>}
                {absences.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={a.status === "approved" ? "default" : "secondary"}>{ABSENCE_LABELS[a.type]}</Badge>
                      <span>{fmtDay(a.start_date)}{a.end_date !== a.start_date && ` – ${fmtDay(a.end_date)}`}</span>
                      {a.status === "pending" && <span className="text-xs text-muted-foreground">Pending</span>}
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => cancel(a.id)}>Cancel</Button>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};
