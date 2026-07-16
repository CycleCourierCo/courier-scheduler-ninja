import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { calculateLabourPrice, formatGBP } from "@/lib/labourPricing";
import {
  LabourTimeRow,
  nextCustomRepairId,
  updateLabourTime,
  upsertLabourTime,
} from "@/services/labourTimesService";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  row: LabourTimeRow | null;
  hourlyRate: number;
  minCharge: number;
  onSaved: () => void;
}

const SKILL_LEVELS = ["Apprentice", "Qualified", "Senior", "Master"] as const;
const YES_NO_FIELDS: Array<keyof LabourTimeRow> = [
  "combinable",
  "safety_critical",
  "warranty_eligible",
  "test_ride_required",
  "torque_check_required",
  "software_calibration_required",
  "suspension_setup_required",
  "brake_bed_in_required",
];

const YES_NO_LABELS: Record<string, string> = {
  combinable: "Combinable",
  safety_critical: "Safety critical",
  warranty_eligible: "Warranty eligible",
  test_ride_required: "Test ride required",
  torque_check_required: "Torque check required",
  software_calibration_required: "Software calibration",
  suspension_setup_required: "Suspension setup",
  brake_bed_in_required: "Brake bed-in",
};

function emptyRow(): LabourTimeRow {
  return {
    repair_id: "",
    bike_type: "",
    category: "",
    subcategory: "",
    repair_name: "",
    labour_minutes: 30,
    min_charge_gbp: 15,
    difficulty_1_5: 2,
    skill_level: "Qualified",
    specialist_tools: "",
    common_parts: "",
    combinable: "Yes",
    combined_saving_minutes: 0,
    safety_critical: "No",
    warranty_eligible: "Yes",
    test_ride_required: "No",
    torque_check_required: "No",
    software_calibration_required: "No",
    suspension_setup_required: "No",
    brake_bed_in_required: "No",
    notes: "",
  };
}

export default function LabourTimeDialog({ open, onOpenChange, row, hourlyRate, minCharge, onSaved }: Props) {
  const isEdit = !!row;
  const [form, setForm] = useState<LabourTimeRow>(emptyRow());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(row ? { ...row } : emptyRow());
  }, [open, row]);

  const price = useMemo(
    () => calculateLabourPrice(Number(form.labour_minutes) || 0, hourlyRate, minCharge),
    [form.labour_minutes, hourlyRate, minCharge]
  );

  const set = <K extends keyof LabourTimeRow>(key: K, value: LabourTimeRow[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function handleSave() {
    if (!form.bike_type || !form.category || !form.subcategory || !form.repair_name) {
      toast.error("Bike type, category, subcategory and repair name are required");
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        const { repair_id, ...patch } = form;
        await updateLabourTime(repair_id, patch);
      } else {
        let repair_id = form.repair_id.trim();
        if (!repair_id) {
          repair_id = await nextCustomRepairId();
        }
        await upsertLabourTime({ ...form, repair_id });
      }
      toast.success(isEdit ? "Labour time updated" : "Labour time added");
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${row?.repair_id}` : "Add repair"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this labour time. Prices displayed elsewhere use the current workshop rate."
              : "A new CUS-#### repair id is auto-generated on save."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          <div className="space-y-2">
            <Label>Repair ID</Label>
            <Input value={form.repair_id} disabled={isEdit} placeholder="Auto (CUS-####)"
                   onChange={(e) => set("repair_id", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Bike type *</Label>
            <Input value={form.bike_type} onChange={(e) => set("bike_type", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Category *</Label>
            <Input value={form.category} onChange={(e) => set("category", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Subcategory *</Label>
            <Input value={form.subcategory} onChange={(e) => set("subcategory", e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Repair name *</Label>
            <Input value={form.repair_name} onChange={(e) => set("repair_name", e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Labour minutes</Label>
            <Input type="number" min={0} value={form.labour_minutes}
                   onChange={(e) => set("labour_minutes", Number(e.target.value) || 0)} />
          </div>
          <div className="space-y-2">
            <Label>Min charge (£)</Label>
            <Input type="number" min={0} value={form.min_charge_gbp}
                   onChange={(e) => set("min_charge_gbp", Number(e.target.value) || 0)} />
            <p className="text-xs text-muted-foreground">
              Legacy field — display prices use workshop rate. Estimated: {formatGBP(price)}
            </p>
          </div>
          <div className="space-y-2">
            <Label>Difficulty (1–5)</Label>
            <Select value={String(form.difficulty_1_5)} onValueChange={(v) => set("difficulty_1_5", Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Skill level</Label>
            <Select value={form.skill_level} onValueChange={(v) => set("skill_level", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SKILL_LEVELS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Combined saving (min)</Label>
            <Input type="number" min={0} value={form.combined_saving_minutes}
                   onChange={(e) => set("combined_saving_minutes", Number(e.target.value) || 0)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Specialist tools</Label>
            <Input value={form.specialist_tools ?? ""} onChange={(e) => set("specialist_tools", e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Common parts</Label>
            <Input value={form.common_parts ?? ""} onChange={(e) => set("common_parts", e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Notes</Label>
            <Textarea rows={2} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
          </div>

          <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t">
            {YES_NO_FIELDS.map((f) => (
              <div key={String(f)} className="flex items-center justify-between rounded-md border px-3 py-2">
                <Label className="text-xs">{YES_NO_LABELS[f as string]}</Label>
                <Switch
                  checked={form[f] === "Yes"}
                  onCheckedChange={(c) => set(f, (c ? "Yes" : "No") as any)}
                />
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
