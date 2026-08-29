import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useSites } from "@/hooks/useSites";
import { useSaveEquipmentType } from "@/hooks/useEquipment";
import type { EquipmentType, EquipmentTypeFormData } from "@/types/equipment";

const EMPTY: EquipmentTypeFormData = {
  name: "",
  category: "",
  description: "",
  manufacturer: "",
  model: "",
  requires_maintenance: false,
  maintenance_interval_days: "",
  default_site_id: null,
  is_active: true,
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: EquipmentType | null;
}

const EquipmentTypeDialog: React.FC<Props> = ({ open, onOpenChange, editing }) => {
  const { data: sites = [] } = useSites(true);
  const save = useSaveEquipmentType();
  const [form, setForm] = useState<EquipmentTypeFormData>(EMPTY);

  useEffect(() => {
    if (!open) return;
    setForm(
      editing
        ? {
            name: editing.name,
            category: editing.category || "",
            description: editing.description || "",
            manufacturer: editing.manufacturer || "",
            model: editing.model || "",
            requires_maintenance: editing.requires_maintenance,
            maintenance_interval_days: editing.maintenance_interval_days
              ? String(editing.maintenance_interval_days)
              : "",
            default_site_id: editing.default_site_id,
            is_active: editing.is_active,
          }
        : EMPTY,
    );
  }, [open, editing]);

  const set = <K extends keyof EquipmentTypeFormData>(key: K, value: EquipmentTypeFormData[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Give this equipment a name, e.g. Wheel adapter or Racking bar.");
      return;
    }
    if (form.requires_maintenance) {
      const days = parseInt(form.maintenance_interval_days, 10);
      if (!Number.isFinite(days) || days < 1) {
        toast.error("Enter how many days between checks (e.g. 90).");
        return;
      }
    }
    try {
      await save.mutateAsync({ id: editing?.id, form });
      toast.success(editing ? "Equipment updated" : "Equipment added");
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.message || "Could not save this equipment");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit equipment" : "New equipment"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="eq-name">Name</Label>
            <Input
              id="eq-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Wheel adapter"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="eq-category">Category</Label>
              <Input
                id="eq-category"
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                placeholder="Racking"
              />
            </div>
            <div className="space-y-2">
              <Label>Home site</Label>
              <Select
                value={form.default_site_id ?? "none"}
                onValueChange={(v) => set("default_site_id", v === "none" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No home site" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No home site</SelectItem>
                  {sites.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="eq-manufacturer">Manufacturer</Label>
              <Input
                id="eq-manufacturer"
                value={form.manufacturer}
                onChange={(e) => set("manufacturer", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eq-model">Model</Label>
              <Input id="eq-model" value={form.model} onChange={(e) => set("model", e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="eq-description">Description</Label>
            <Textarea
              id="eq-description"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="pr-3">
              <p className="text-sm font-medium">Needs regular checks</p>
              <p className="text-xs text-muted-foreground">
                Track safety or service checks for every item of this equipment.
              </p>
            </div>
            <Switch
              checked={form.requires_maintenance}
              onCheckedChange={(v) => set("requires_maintenance", v)}
            />
          </div>

          {form.requires_maintenance && (
            <div className="space-y-2">
              <Label htmlFor="eq-interval">Days between checks</Label>
              <Input
                id="eq-interval"
                type="number"
                min={1}
                value={form.maintenance_interval_days}
                onChange={(e) => set("maintenance_interval_days", e.target.value)}
                placeholder="90"
              />
            </div>
          )}

          <div className="flex items-center justify-between rounded-md border p-3">
            <p className="text-sm font-medium">Active</p>
            <Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={save.isPending}>
            {save.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EquipmentTypeDialog;
