import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { MultiplierRow, updateMultiplier, upsertMultiplier } from "@/services/labourTimesService";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  row: MultiplierRow | null;
  onSaved: () => void;
}

function empty(): MultiplierRow {
  return { modifier: "", adjustment_type: "percent", value: 0, applies_to: "", notes: "" };
}

export default function MultiplierDialog({ open, onOpenChange, row, onSaved }: Props) {
  const isEdit = !!row;
  const [form, setForm] = useState<MultiplierRow>(empty());
  const [saving, setSaving] = useState(false);
  const originalModifier = row?.modifier;

  useEffect(() => {
    if (open) setForm(row ? { ...row } : empty());
  }, [open, row]);

  async function handleSave() {
    if (!form.modifier.trim()) {
      toast.error("Modifier name is required");
      return;
    }
    setSaving(true);
    try {
      if (isEdit && originalModifier && originalModifier !== form.modifier) {
        // Rename PK: delete + insert
        await upsertMultiplier(form);
      } else if (isEdit) {
        const { modifier, ...patch } = form;
        await updateMultiplier(modifier, patch);
      } else {
        await upsertMultiplier(form);
      }
      toast.success(isEdit ? "Multiplier updated" : "Multiplier added");
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit multiplier" : "Add multiplier"}</DialogTitle>
          <DialogDescription>
            Modifiers adjust labour time (fixed minutes) or price (percent).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-2">
            <Label>Modifier *</Label>
            <Input value={form.modifier} onChange={(e) => setForm({ ...form, modifier: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Adjustment type</Label>
              <Select value={form.adjustment_type} onValueChange={(v) => setForm({ ...form, adjustment_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percent</SelectItem>
                  <SelectItem value="minutes">Minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Value</Label>
              <Input type="number" value={form.value}
                     onChange={(e) => setForm({ ...form, value: Number(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Applies to</Label>
            <Input value={form.applies_to ?? ""} onChange={(e) => setForm({ ...form, applies_to: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea rows={2} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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
