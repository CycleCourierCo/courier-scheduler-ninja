import React, { useEffect, useMemo, useState } from "react";
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
import { useSites, defaultSite } from "@/hooks/useSites";
import { useAddEquipmentUnits } from "@/hooks/useEquipment";
import { buildSerials, type AddUnitsInput } from "@/services/equipmentService";
import {
  EQUIPMENT_CONDITION_LABELS,
  type EquipmentCondition,
  type EquipmentType,
} from "@/types/equipment";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  types: EquipmentType[];
  presetTypeId?: string | null;
}

const AddEquipmentUnitsDialog: React.FC<Props> = ({ open, onOpenChange, types, presetTypeId }) => {
  const { data: sites = [] } = useSites(true);
  const addUnits = useAddEquipmentUnits();

  const [typeId, setTypeId] = useState<string>("");
  const [quantity, setQuantity] = useState("1");
  const [serialPrefix, setSerialPrefix] = useState("");
  const [serialStart, setSerialStart] = useState("1");
  const [condition, setCondition] = useState<EquipmentCondition>("new");
  const [siteId, setSiteId] = useState<string | null>(null);
  const [purchaseDate, setPurchaseDate] = useState("");
  const [purchaseCost, setPurchaseCost] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setTypeId(presetTypeId || types[0]?.id || "");
    setQuantity("1");
    setSerialPrefix("");
    setSerialStart("1");
    setCondition("new");
    setSiteId(defaultSite(sites)?.id ?? null);
    setPurchaseDate("");
    setPurchaseCost("");
    setNotes("");
  }, [open, presetTypeId, types, sites]);

  const qty = parseInt(quantity, 10);

  const preview = useMemo(() => {
    if (!Number.isFinite(qty) || qty < 1) return [];
    const serials = buildSerials({
      equipment_type_id: typeId,
      quantity: Math.min(qty, 3),
      serialPrefix,
      serialStart: parseInt(serialStart, 10) || 1,
      condition,
      site_id: siteId,
      purchase_date: null,
      purchase_cost: "",
      notes: "",
    } as AddUnitsInput);
    return serials.filter(Boolean) as string[];
  }, [qty, typeId, serialPrefix, serialStart, condition, siteId]);

  const handleSave = async () => {
    if (!typeId) return toast.error("Pick which equipment you are adding.");
    if (!Number.isFinite(qty) || qty < 1 || qty > 200)
      return toast.error("Enter how many items you're adding (1 to 200).");

    try {
      const count = await addUnits.mutateAsync({
        equipment_type_id: typeId,
        quantity: qty,
        serialPrefix,
        serialStart: parseInt(serialStart, 10) || 1,
        condition,
        site_id: siteId,
        purchase_date: purchaseDate || null,
        purchase_cost: purchaseCost,
        notes,
      });
      toast.success(`${count} item${count === 1 ? "" : "s"} added`);
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.message || "Could not add these items");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add items to stock</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Equipment</Label>
            <Select value={typeId} onValueChange={setTypeId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose equipment" />
              </SelectTrigger>
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="eq-qty">How many</Label>
              <Input
                id="eq-qty"
                type="number"
                min={1}
                max={200}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eq-prefix">Serial prefix</Label>
              <Input
                id="eq-prefix"
                value={serialPrefix}
                onChange={(e) => setSerialPrefix(e.target.value)}
                placeholder="WA-"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eq-start">Start at</Label>
              <Input
                id="eq-start"
                type="number"
                min={1}
                value={serialStart}
                onChange={(e) => setSerialStart(e.target.value)}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {preview.length
              ? `Serials will look like: ${preview.join(", ")}${qty > 3 ? "…" : ""}`
              : "Leave the prefix blank to add items without serials."}
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            <div className="space-y-2">
              <Label>Site</Label>
              <Select
                value={siteId ?? "none"}
                onValueChange={(v) => setSiteId(v === "none" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
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
              <Label htmlFor="eq-date">Purchase date</Label>
              <Input
                id="eq-date"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eq-cost">Cost each (£)</Label>
              <Input
                id="eq-cost"
                type="number"
                min={0}
                step="0.01"
                value={purchaseCost}
                onChange={(e) => setPurchaseCost(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="eq-notes">Notes</Label>
            <Textarea
              id="eq-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={addUnits.isPending}>
            {addUnits.isPending ? "Adding..." : "Add items"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddEquipmentUnitsDialog;
