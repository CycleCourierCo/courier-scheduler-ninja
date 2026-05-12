import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  createPolicy, updatePolicy, type InsurancePolicy,
} from "@/services/insuranceService";
import type { Vehicle } from "@/services/vehicleService";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicles: Vehicle[];
  policy?: InsurancePolicy | null;
  defaultVehicleId?: string | null;
  onSaved: () => void;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function PolicyDialog({
  open, onOpenChange, vehicles, policy, defaultVehicleId, onSaved,
}: Props) {
  const editing = !!policy;
  const [vehicleId, setVehicleId] = useState<string>("");
  const [insurer, setInsurer] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState("");
  const [premium, setPremium] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (policy) {
      setVehicleId(policy.vehicle_id);
      setInsurer(policy.insurer);
      setPolicyNumber(policy.policy_number ?? "");
      setStartDate(policy.start_date);
      setEndDate(policy.end_date);
      setPremium(policy.premium != null ? String(policy.premium) : "");
      setNotes(policy.notes ?? "");
    } else {
      setVehicleId(defaultVehicleId ?? "");
      setInsurer("");
      setPolicyNumber("");
      setStartDate(todayStr());
      setEndDate("");
      setPremium("");
      setNotes("");
    }
  }, [open, policy, defaultVehicleId]);

  const sortedVehicles = useMemo(
    () => [...vehicles].sort((a, b) => a.registration.localeCompare(b.registration)),
    [vehicles],
  );

  const submit = async () => {
    if (!vehicleId || !insurer || !startDate || !endDate) {
      toast.error("Vehicle, insurer, start and end date are required");
      return;
    }
    if (endDate < startDate) {
      toast.error("End date must be after start date");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        vehicle_id: vehicleId,
        insurer: insurer.trim(),
        policy_number: policyNumber.trim() || null,
        start_date: startDate,
        end_date: endDate,
        premium: premium ? Number(premium) : null,
        notes: notes.trim() || null,
      };
      if (editing && policy) {
        await updatePolicy(policy.id, payload);
        toast.success("Policy updated");
      } else {
        await createPolicy(payload);
        toast.success("Policy added");
      }
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit policy" : "Add insurance policy"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Vehicle</Label>
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
              <SelectContent>
                {sortedVehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.registration} {v.make ? `· ${v.make}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ins">Insurer</Label>
            <Input id="ins" value={insurer} onChange={(e) => setInsurer(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pn">Policy number</Label>
            <Input id="pn" value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="sd">Start date</Label>
              <Input id="sd" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ed">End date</Label>
              <Input id="ed" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="prem">Premium (£)</Label>
            <Input id="prem" type="number" inputMode="decimal" min={0} step="0.01"
              value={premium} onChange={(e) => setPremium(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {editing ? "Save" : "Add policy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
