import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { WarehouseStock } from "@/types/warehouseStock";
import type { BikeHotspot } from "@/constants/bikeComponents";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hotspot: BikeHotspot | null;
  stock: WarehouseStock[];
  adding: boolean;
  onAdd: (items: WarehouseStock[]) => void;
};

const PickComponentDialog: React.FC<Props> = ({ open, onOpenChange, hotspot, stock, adding, onAdd }) => {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);

  const options = useMemo(() => {
    const term = search.trim().toLowerCase();
    return stock.filter((item) => {
      const inSlot = !hotspot || showAll || hotspot.categories.includes(item.component_category || "");
      if (!inSlot) return false;
      if (!term) return true;
      return [item.component_category, item.bike_brand, item.bike_model, item.spec, item.sku]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [stock, hotspot, search, showAll]);

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const handleAdd = () => {
    onAdd(stock.filter((s) => selected.includes(s.id)));
    setSelected([]);
    setSearch("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setSelected([]);
          setSearch("");
          setShowAll(false);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="w-[calc(100vw-2rem)] sm:w-auto max-w-lg overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>{hotspot ? `Add ${hotspot.label.toLowerCase()} parts` : "Add parts"}</DialogTitle>
          <DialogDescription>
            Only parts currently in stock for this customer are shown.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="min-w-0 flex-1"
            placeholder="Search brand, model, spec or SKU"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "This area" : "All parts"}
          </Button>
        </div>


        <ScrollArea className="max-h-72 pr-2">
          {options.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No matching parts in stock.
            </p>
          ) : (
            <div className="space-y-2">
              {options.map((item) => (
                <label
                  key={item.id}
                  className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent/50"
                >
                  <Checkbox checked={selected.includes(item.id)} onCheckedChange={() => toggle(item.id)} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      {[item.bike_brand, item.bike_model].filter(Boolean).join(" ") || item.component_category}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[item.component_category, item.spec, item.quantity > 1 ? `x${item.quantity}` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-[10px]">
                        Bay {item.bay} · Pos {item.position}
                      </Badge>
                      {item.bike_value != null && (
                        <Badge variant="secondary" className="text-[10px]">
                          £{Number(item.bike_value).toFixed(2)}
                        </Badge>
                      )}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-end gap-2">
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
