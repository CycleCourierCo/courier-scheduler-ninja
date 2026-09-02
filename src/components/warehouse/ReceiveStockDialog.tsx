import React, { useEffect, useState } from "react";
import * as Sentry from "@sentry/react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStorageBays } from "@/hooks/useStorageBays";
import { receiveComponentStock } from "@/services/warehouseStockService";
import type { WarehouseStock } from "@/types/warehouseStock";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: WarehouseStock | null;
  siteId: string | null;
  onReceived: () => void;
};

const HOLDING_BAY = "UNALLOCATED";

const ReceiveStockDialog: React.FC<Props> = ({ open, onOpenChange, item, siteId, onReceived }) => {
  const { bays } = useStorageBays(false, siteId);
  const [quantity, setQuantity] = useState(1);
  const [bay, setBay] = useState("");
  const [position, setPosition] = useState(1);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !item) return;
    setQuantity(1);
    setBay(item.bay && item.bay !== HOLDING_BAY ? item.bay : "");
    setPosition(item.bay && item.bay !== HOLDING_BAY ? item.position : 1);
    setNote("");
  }, [open, item]);

  const selectedBay = bays.find((b) => b.label === bay);
  const partName = item
    ? [item.component_category, item.spec].filter(Boolean).join(" · ")
    : "";

  const handleSave = async () => {
    if (!item) return;
    if (!quantity || quantity < 1) {
      toast.error("Enter how many of this part arrived.");
      return;
    }
    if (!bay || !position) {
      toast.error("Choose the bay and position this stock is going into.");
      return;
    }
    setSaving(true);
    try {
      await receiveComponentStock({
        id: item.id,
        currentQuantity: Number(item.quantity || 0),
        received: quantity,
        bay,
        position,
        note: note.trim() || null,
        existingNotes: item.item_notes,
      });
      toast.success(`Received ${quantity} × ${item.component_category || "part"}`);
      onOpenChange(false);
      onReceived();
    } catch (err) {
      Sentry.captureException(err);
      toast.error("Couldn't book this stock in. Check the details and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Receive stock</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {item && (
            <div className="rounded-md border p-3 text-sm">
              <div className="font-medium">{item.component_category || "Part"}</div>
              {item.spec && <div className="text-xs text-muted-foreground">{item.spec}</div>}
              <div className="text-xs text-muted-foreground mt-1">
                Currently in stock: {Number(item.quantity || 0)}
              </div>
            </div>
          )}

          <div>
            <Label>Quantity received *</Label>
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 0)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Bay *</Label>
              <Select value={bay} onValueChange={(v) => { setBay(v); setPosition(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select bay" />
                </SelectTrigger>
                <SelectContent>
                  {bays.map((b) => (
                    <SelectItem key={b.id} value={b.label}>{b.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Position *</Label>
              <Input
                type="number"
                min={1}
                max={selectedBay?.capacity ?? undefined}
                disabled={!bay}
                value={position}
                onChange={(e) => setPosition(parseInt(e.target.value, 10) || 1)}
              />
            </div>
          </div>

          <div>
            <Label>Note</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. delivery note number, supplier"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            {partName ? `Adds to the existing count for ${partName}.` : "Adds to the existing count for this part."}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Receive stock"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReceiveStockDialog;
