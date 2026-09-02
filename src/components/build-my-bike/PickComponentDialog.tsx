import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { WarehouseStock } from "@/types/warehouseStock";
import type { BikeHotspot } from "@/constants/bikeComponents";
import StockPickerList from "./StockPickerList";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hotspot: BikeHotspot | null;
  stock: WarehouseStock[];
  adding: boolean;
  onAdd: (items: WarehouseStock[]) => void;
};

const PickComponentDialog: React.FC<Props> = ({ open, onOpenChange, hotspot, stock, adding, onAdd }) => {
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const handleAdd = () => {
    onAdd(stock.filter((s) => selected.includes(s.id)));
    setSelected([]);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setSelected([]);
        onOpenChange(next);
      }}
    >
      <DialogContent className="w-full max-w-[calc(100vw-2rem)] sm:max-w-lg overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>{hotspot ? `Add ${hotspot.label.toLowerCase()} parts` : "Add parts"}</DialogTitle>
          <DialogDescription>
            Only parts currently in stock for this customer are shown.
          </DialogDescription>
        </DialogHeader>

        <StockPickerList stock={stock} hotspot={hotspot} selected={selected} onToggle={toggle} />

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleAdd} disabled={selected.length === 0 || adding}>
            {adding ? "Adding…" : `Add ${selected.length || ""} part${selected.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PickComponentDialog;
