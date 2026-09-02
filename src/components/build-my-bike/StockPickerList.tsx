import React, { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { WarehouseStock } from "@/types/warehouseStock";
import type { BikeHotspot } from "@/constants/bikeComponents";

type Props = {
  stock: WarehouseStock[];
  /** When set, only parts matching this area's categories are shown until "All parts" is toggled. */
  hotspot?: BikeHotspot | null;
  selected: string[];
  onToggle: (id: string) => void;
  emptyLabel?: string;
  className?: string;
};

/** Searchable, multi-select list of in-stock components shared by the build dialogs. */
const StockPickerList: React.FC<Props> = ({
  stock,
  hotspot,
  selected,
  onToggle,
  emptyLabel = "No matching parts in stock.",
  className = "max-h-72",
}) => {
  const [search, setSearch] = useState("");
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

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="min-w-0 flex-1"
          placeholder="Search brand, model, spec or SKU"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {hotspot && (
          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "This area" : "All parts"}
          </Button>
        )}
      </div>

      <ScrollArea className={`${className} pr-2`}>
        {options.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">{emptyLabel}</p>
        ) : (
          <div className="space-y-2">
            {options.map((item) => (
              <label
                key={item.id}
                className="flex min-w-0 items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent/50"
              >
                <Checkbox
                  className="mt-0.5 shrink-0"
                  checked={selected.includes(item.id)}
                  onCheckedChange={() => onToggle(item.id)}
                />
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
    </div>
  );
};

export default StockPickerList;
