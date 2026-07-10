import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  DEFAULT_INTERVALS,
  formatServiceLabel,
  type ServicePosition,
  type ServiceType,
} from "@/constants/vehicleMaintenance";
import {
  listIntervals,
  upsertInterval,
  type MaintenanceInterval,
} from "@/services/vehicleMaintenanceService";

interface Props {
  vehicleId: string;
  vehicleReg: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

interface Row {
  serviceType: ServiceType;
  position: ServicePosition | null;
  customName: string | null;
  miles: string;
  months: string;
}

const MaintenanceIntervalsDialog = ({ vehicleId, vehicleReg, open, onOpenChange, onSaved }: Props) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [intervals, setIntervals] = useState<MaintenanceInterval[]>([]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listIntervals(vehicleId)
      .then(setIntervals)
      .catch((e) => toast.error((e as Error).message))
      .finally(() => setLoading(false));
  }, [open, vehicleId]);

  const rows: Row[] = useMemo(() => {
    return DEFAULT_INTERVALS.map((d) => {
      const override = intervals.find(
        (i) => i.service_type === d.serviceType && (i.position ?? null) === (d.position ?? null) && !i.custom_name,
      );
      return {
        serviceType: d.serviceType,
        position: d.position ?? null,
        customName: null,
        miles: String(override?.interval_miles ?? d.miles ?? ""),
        months: String(override?.interval_months ?? d.months ?? ""),
      };
    });
  }, [intervals]);

  const [edited, setEdited] = useState<Record<string, { miles: string; months: string }>>({});

  useEffect(() => {
    // reset edits when intervals reload
    setEdited({});
  }, [intervals]);

  const keyOf = (r: Row) => `${r.serviceType}|${r.position ?? ""}`;

  const handleChange = (r: Row, field: "miles" | "months", value: string) => {
    setEdited((prev) => ({
      ...prev,
      [keyOf(r)]: {
        miles: prev[keyOf(r)]?.miles ?? r.miles,
        months: prev[keyOf(r)]?.months ?? r.months,
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const entries = Object.entries(edited);
      for (const [k, vals] of entries) {
        const [serviceType, positionStr] = k.split("|");
        const position = positionStr ? (positionStr as ServicePosition) : null;
        await upsertInterval({
          vehicle_id: vehicleId,
          service_type: serviceType as ServiceType,
          position,
          custom_name: null,
          interval_miles: vals.miles ? Number(vals.miles) : null,
          interval_months: vals.months ? Number(vals.months) : null,
        });
      }
      toast.success("Intervals saved");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Service intervals — {vehicleReg}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr,100px,100px] gap-2 text-xs text-muted-foreground font-medium">
              <div>Service</div>
              <div>Miles</div>
              <div>Months</div>
            </div>
            {rows.map((r) => {
              const k = keyOf(r);
              const e = edited[k];
              return (
                <div key={k} className="grid grid-cols-[1fr,100px,100px] gap-2 items-center">
                  <div className="text-sm">{formatServiceLabel(r.serviceType, r.position, r.customName)}</div>
                  <Input
                    type="number"
                    value={e?.miles ?? r.miles}
                    onChange={(ev) => handleChange(r, "miles", ev.target.value)}
                    placeholder="—"
                  />
                  <Input
                    type="number"
                    value={e?.months ?? r.months}
                    onChange={(ev) => handleChange(r, "months", ev.target.value)}
                    placeholder="—"
                  />
                </div>
              );
            })}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || Object.keys(edited).length === 0}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MaintenanceIntervalsDialog;
