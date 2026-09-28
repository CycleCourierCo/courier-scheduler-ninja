import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ActiveUser } from "@/services/activeUsersService";
import { AbsenceType, createRequest, errorText, londonToday, notifyAbsence } from "@/services/driverRotaService";

interface Props { open: boolean; onOpenChange: (o: boolean) => void; drivers: ActiveUser[]; onSaved: () => void }

export const LogAbsenceDialog = ({ open, onOpenChange, drivers, onSaved }: Props) => {
  const today = londonToday();
  const [driverId, setDriverId] = useState("");
  const [type, setType] = useState<AbsenceType>("sick");
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!driverId) { toast.error("Pick a driver"); return; }
    if (end < start) { toast.error("End date must be on or after the start date"); return; }
    setSaving(true);
    try {
      const r = await createRequest({ driver_id: driverId, type, start_date: start, end_date: end, note, status: "approved" });
      notifyAbsence(r.id, "decided");
      toast.success("Absence logged");
      onSaved(); onOpenChange(false); setNote("");
    } catch (e) { toast.error(errorText(e)); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Log absence for a driver</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Driver</Label>
            <Select value={driverId} onValueChange={setDriverId}>
              <SelectTrigger><SelectValue placeholder="Choose driver" /></SelectTrigger>
              <SelectContent>{drivers.map((d) => <SelectItem key={d.id} value={d.id}>{d.name || d.email}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="space-y-1"><Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as AbsenceType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sick">Sick</SelectItem>
                <SelectItem value="holiday">Holiday</SelectItem>
                <SelectItem value="unpaid">Unpaid leave</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>First day</Label><Input type="date" value={start} onChange={(e) => { setStart(e.target.value); if (e.target.value > end) setEnd(e.target.value); }} /></div>
            <div className="space-y-1"><Label>Last day</Label><Input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} /></div>
          </div>
          <div className="space-y-1"><Label>Note <span className="text-xs text-muted-foreground">(Visible to admins only)</span></Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <p className="text-xs text-muted-foreground">Saved as already approved.</p>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Log absence"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
