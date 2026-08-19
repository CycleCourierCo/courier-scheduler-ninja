import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Package } from "lucide-react";
import { toast } from "sonner";
import { useStorageBays, getBayMaxPosition } from "@/hooks/useStorageBays";

export interface BikeLocationValue {
  /** Bay label, e.g. "A" */
  bay: string;
  /** 1-based slot within the bay */
  position: number;
}

interface ChangeStorageLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** One entry per bike being placed. Empty bay/position 0 means "not allocated yet". */
  initialLocations: BikeLocationValue[];
  /** Shown under the title, e.g. "Acme Cycles - Trek Domane" */
  subtitle?: string;
  saving?: boolean;
  onSave: (locations: BikeLocationValue[]) => void | Promise<void>;
}

/**
 * Shared bay/position editor used by the Loading page and the Bicycle Inspections
 * page so both surfaces validate and present storage moves identically.
 */
export const ChangeStorageLocationDialog = ({
  open,
  onOpenChange,
  initialLocations,
  subtitle,
  saving = false,
  onSave,
}: ChangeStorageLocationDialogProps) => {
  const { bays } = useStorageBays();
  const validBayLabels = bays.map((b) => b.label.toUpperCase());
  const bayHelp = validBayLabels.length ? validBayLabels.join(", ") : "—";

  const [newBays, setNewBays] = useState<string[]>([]);
  const [newPositions, setNewPositions] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setNewBays(initialLocations.map((l) => (l.bay || "").toUpperCase()));
    setNewPositions(initialLocations.map((l) => (l.position ? String(l.position) : "")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, JSON.stringify(initialLocations)]);

  const isMultiBike = initialLocations.length > 1;

  const handleSave = async () => {
    const results: BikeLocationValue[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < initialLocations.length; i++) {
      const label = isMultiBike ? `Bike ${i + 1}: ` : "";
      const bayUpper = (newBays[i] || "").toUpperCase();
      const positionNum = parseInt(newPositions[i] || "", 10);

      if (!bayUpper || !newPositions[i]) {
        toast.error(`${label}Please enter both bay and position`);
        return;
      }
      if (!validBayLabels.includes(bayUpper)) {
        toast.error(`${label}Bay must be one of ${bayHelp}`);
        return;
      }
      const maxPos = getBayMaxPosition(bays, bayUpper) ?? 0;
      if (isNaN(positionNum) || positionNum < 1 || positionNum > maxPos) {
        toast.error(`${label}Position must be between 1 and ${maxPos} for Bay ${bayUpper}`);
        return;
      }
      const key = `${bayUpper}${positionNum}`;
      if (seen.has(key)) {
        toast.error(`Duplicate position: Bay ${key}`);
        return;
      }
      seen.add(key);
      results.push({ bay: bayUpper, position: positionNum });
    }

    await onSave(results);
  };

  const renderRow = (index: number, current?: BikeLocationValue) => (
    <div className="flex gap-3 items-end">
      <div className="flex-1">
        <Label htmlFor={`storage-bay-${index}`} className="text-sm">
          Bay ({bayHelp})
        </Label>
        <Input
          id={`storage-bay-${index}`}
          value={newBays[index] || ""}
          onChange={(e) => {
            const updated = [...newBays];
            updated[index] = e.target.value.toUpperCase();
            setNewBays(updated);
          }}
          placeholder="A"
          maxLength={1}
          className="text-center uppercase"
        />
      </div>
      <div className="flex-1">
        <Label htmlFor={`storage-position-${index}`} className="text-sm">
          Position
        </Label>
        <Input
          id={`storage-position-${index}`}
          value={newPositions[index] || ""}
          onChange={(e) => {
            const updated = [...newPositions];
            updated[index] = e.target.value;
            setNewPositions(updated);
          }}
          placeholder="1"
          type="number"
          min="1"
          className="text-center"
        />
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isMultiBike ? "Manage Storage Locations" : "Change Storage Location"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {subtitle && (
            <div className="text-sm text-muted-foreground break-words">{subtitle}</div>
          )}

          {isMultiBike ? (
            <div className="space-y-4">
              <div className="text-sm font-medium">Update all bike locations:</div>
              {initialLocations.map((location, index) => (
                <div key={index} className="border rounded-lg p-3 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Package className="h-4 w-4" />
                    <span className="font-medium">
                      Bike {index + 1} of {initialLocations.length}
                    </span>
                    {location.bay && location.position ? (
                      <Badge variant="outline" className="font-mono text-xs">
                        Currently: {location.bay}
                        {location.position}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        Not allocated
                      </Badge>
                    )}
                  </div>
                  {renderRow(index, location)}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm font-medium">New location:</div>
              {renderRow(0, initialLocations[0])}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 min-h-[44px]"
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1 min-h-[44px]">
              {saving
                ? "Saving…"
                : isMultiBike
                  ? `Update All ${initialLocations.length}`
                  : "Update Location"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ChangeStorageLocationDialog;
