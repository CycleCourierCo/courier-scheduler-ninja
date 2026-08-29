import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useLogMaintenance, useMaintenanceLogs } from "@/hooks/useEquipment";
import {
  EQUIPMENT_RESULT_LABELS,
  type EquipmentMaintenanceResult,
  type EquipmentUnit,
} from "@/types/equipment";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unit: EquipmentUnit | null;
  typeName?: string;
}

const today = () => new Date().toISOString().slice(0, 10);

const EquipmentMaintenanceDialog: React.FC<Props> = ({ open, onOpenChange, unit, typeName }) => {
  const logMaintenance = useLogMaintenance();
  const { data: logs = [] } = useMaintenanceLogs(open ? unit?.id : undefined);

  const [performedAt, setPerformedAt] = useState(today());
  const [result, setResult] = useState<EquipmentMaintenanceResult>("pass");
  const [nextDue, setNextDue] = useState("");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setPerformedAt(today());
    setResult("pass");
    setNextDue("");
    setCost("");
    setNotes("");
  }, [open, unit]);

  const handleSave = async () => {
    if (!unit) return;
    if (!performedAt) return toast.error("Pick the date the check was done.");
    try {
      await logMaintenance.mutateAsync({
        unit_id: unit.id,
        performed_at: performedAt,
        result,
        notes,
        next_due_at: nextDue || null,
        cost,
        markInRepair: result === "fail",
      });
      toast.success(
        result === "fail" ? "Check logged — item marked as in repair" : "Check logged",
      );
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.message || "Could not log this check");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="break-words">
            Log a check{typeName ? ` — ${typeName}` : ""}
            {unit?.serial ? ` (${unit.serial})` : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="eq-mx-date">Date checked</Label>
              <Input
                id="eq-mx-date"
                type="date"
                value={performedAt}
                onChange={(e) => setPerformedAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Result</Label>
              <Select
                value={result}
                onValueChange={(v) => setResult(v as EquipmentMaintenanceResult)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EQUIPMENT_RESULT_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="eq-mx-next">Next check due</Label>
              <Input
                id="eq-mx-next"
                type="date"
                value={nextDue}
                onChange={(e) => setNextDue(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to use the standard interval for this equipment.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="eq-mx-cost">Cost (£)</Label>
              <Input
                id="eq-mx-cost"
                type="number"
                min={0}
                step="0.01"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="eq-mx-notes">Notes</Label>
            <Textarea
              id="eq-mx-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {result === "fail" && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm">
              A failed check moves this item to "In repair" so it isn't used.
            </p>
          )}

          <div className="space-y-2">
            <Label>Previous checks</Label>
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No checks logged yet.</p>
            ) : (
              <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                {logs.map((l) => (
                  <li key={l.id} className="text-muted-foreground">
                    {new Date(l.performed_at).toLocaleDateString("en-GB")} —{" "}
                    <span className="text-foreground">{EQUIPMENT_RESULT_LABELS[l.result]}</span>
                    {l.notes ? ` · ${l.notes}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={logMaintenance.isPending}>
            {logMaintenance.isPending ? "Saving..." : "Log check"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EquipmentMaintenanceDialog;
