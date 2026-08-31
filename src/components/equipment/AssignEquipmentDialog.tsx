import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useSites } from "@/hooks/useSites";
import {
  useAssignEquipmentUnit,
  useEquipmentPeople,
  useEquipmentVehicles,
  useUnitMovements,
} from "@/hooks/useEquipment";
import {
  EQUIPMENT_CONDITION_LABELS,
  EQUIPMENT_STATUS_LABELS,
  type EquipmentAssignmentKind,
  type EquipmentCondition,
  type EquipmentUnit,
  type EquipmentUnitStatus,
} from "@/types/equipment";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unit: EquipmentUnit | null;
  typeName?: string;
}

const AssignEquipmentDialog: React.FC<Props> = ({ open, onOpenChange, unit, typeName }) => {
  const { data: sites = [] } = useSites(true);
  const { data: people = [] } = useEquipmentPeople();
  const { data: vehicles = [] } = useEquipmentVehicles();
  const { data: movements = [] } = useUnitMovements(open ? unit?.id : undefined);
  const assign = useAssignEquipmentUnit();

  const [kind, setKind] = useState<EquipmentAssignmentKind | "none">("none");
  const [target, setTarget] = useState<string>("");
  const [status, setStatus] = useState<EquipmentUnitStatus>("available");
  const [condition, setCondition] = useState<EquipmentCondition>("good");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open || !unit) return;
    setKind(unit.assignment_kind ?? "none");
    setTarget(
      unit.assignment_kind === "site"
        ? unit.site_id || ""
        : unit.assignment_kind === "vehicle"
          ? unit.vehicle_id || ""
          : unit.assignment_kind === "person"
            ? unit.assigned_to_user_id || ""
            : "",
    );
    setStatus(unit.status);
    setCondition(unit.condition);
    setNotes(unit.notes || "");
  }, [open, unit]);

  const options =
    kind === "site"
      ? sites.map((s) => ({ value: s.id, label: s.name }))
      : kind === "vehicle"
        ? vehicles.map((v) => ({
            value: v.id,
            label: [v.registration, v.make, v.model].filter(Boolean).join(" · "),
          }))
        : kind === "person"
          ? people.map((p) => ({ value: p.id, label: p.name || p.email || "Unnamed" }))
          : [];

  const labelFor = (
    k: EquipmentAssignmentKind | null,
    siteId: string | null,
    vehicleId: string | null,
    userId: string | null,
  ) => {
    if (k === "site") return sites.find((s) => s.id === siteId)?.name || "Site";
    if (k === "vehicle")
      return vehicles.find((v) => v.id === vehicleId)?.registration || "Vehicle";
    if (k === "person") {
      const p = people.find((x) => x.id === userId);
      return p?.name || p?.email || "Staff member";
    }
    return "Unassigned";
  };

  const handleSave = async () => {
    if (!unit) return;
    if (kind !== "none" && !target) {
      toast.error("Choose where this item is going.");
      return;
    }
    try {
      await assign.mutateAsync({
        id: unit.id,
        input: {
          assignment_kind: kind === "none" ? null : kind,
          site_id: kind === "site" ? target : null,
          vehicle_id: kind === "vehicle" ? target : null,
          assigned_to_user_id: kind === "person" ? target : null,
          status,
          condition,
          notes: notes.trim() || null,
        },
      });
      toast.success("Item updated");
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.message || "Could not update this item");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="break-words">
            {typeName ? `${typeName} — ` : ""}
            {unit?.serial || unit?.asset_tag || "Item"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Where is it?</Label>
              <Select
                value={kind}
                onValueChange={(v) => {
                  setKind(v as EquipmentAssignmentKind | "none");
                  setTarget("");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  <SelectItem value="site">Site</SelectItem>
                  <SelectItem value="vehicle">Vehicle</SelectItem>
                  <SelectItem value="person">Staff member</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {kind !== "none" && (
              <div className="space-y-2">
                <Label>Which one</Label>
                <Select value={target} onValueChange={setTarget}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as EquipmentUnitStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EQUIPMENT_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Condition</Label>
              <Select value={condition} onValueChange={(v) => setCondition(v as EquipmentCondition)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EQUIPMENT_CONDITION_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="eq-unit-notes">Notes</Label>
            <Textarea
              id="eq-unit-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Movement history</Label>
            {movements.length === 0 ? (
              <p className="text-sm text-muted-foreground">No movements recorded yet.</p>
            ) : (
              <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                {movements.map((m) => (
                  <li key={m.id} className="flex flex-wrap gap-1 text-muted-foreground">
                    <span>{new Date(m.moved_at).toLocaleDateString("en-GB")}:</span>
                    <span className="text-foreground">
                      {labelFor(m.from_assignment_kind, m.from_site_id, m.from_vehicle_id, m.from_user_id)}
                      {" → "}
                      {labelFor(m.to_assignment_kind, m.to_site_id, m.to_vehicle_id, m.to_user_id)}
                    </span>
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
          <Button onClick={handleSave} disabled={assign.isPending}>
            {assign.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AssignEquipmentDialog;
