import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { DEFAULT_INTERVALS, formatServiceLabel, type ServicePosition, type ServiceType } from "@/constants/vehicleMaintenance";
import {
  deleteInterval, listFleetIntervalDefaults, listIntervals, upsertFleetIntervalDefault, upsertInterval,
  type FleetIntervalDefault, type MaintenanceInterval,
} from "@/services/vehicleMaintenanceService";

interface Props {
  /** Omit for the fleet-wide defaults that apply to every van. */
  vehicleId?: string | null;
  vehicleReg?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const same = (a: { service_type: string; position: string | null; custom_name: string | null }, s: ServiceType, p: ServicePosition | null) =>
  a.service_type === s && (a.position ?? null) === p && !a.custom_name;

const MaintenanceIntervalsDialog = ({ vehicleId, vehicleReg, open, onOpenChange, onSaved }: Props) => {
  const fleetMode = !vehicleId;
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [own, setOwn] = useState<MaintenanceInterval[]>([]);
  const [fleet, setFleet] = useState<FleetIntervalDefault[]>([]);
  const [edited, setEdited] = useState<Record<string, { miles: string; months: string }>>({});

  const load = () => {
    setLoading(true);
    Promise.all([listFleetIntervalDefaults().catch(() => []), vehicleId ? listIntervals(vehicleId) : Promise.resolve([])])
      .then(([f, o]) => { setFleet(f); setOwn(o); setEdited({}); })
      .catch((e) => toast.error((e as Error).message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (open) load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, vehicleId]);

  const rows = useMemo(() => DEFAULT_INTERVALS.map((d) => {
    const p = d.position ?? null;
    const f = fleet.find((x) => same(x, d.serviceType, p));
    const o = fleetMode ? undefined : own.find((x) => same(x, d.serviceType, p));
    const base = { miles: f?.interval_miles ?? d.miles, months: f?.interval_months ?? d.months };
    const v = o ? { miles: o.interval_miles, months: o.interval_months } : base;
    return { key: `${d.serviceType}|${p ?? ""}`, serviceType: d.serviceType, position: p, override: o ?? null,
      miles: String(v.miles ?? ""), months: String(v.months ?? "") };
  }), [fleet, own, fleetMode]);

  const change = (k: string, r: { miles: string; months: string }, field: "miles" | "months", value: string) =>
    setEdited((prev) => ({ ...prev, [k]: { miles: prev[k]?.miles ?? r.miles, months: prev[k]?.months ?? r.months, [field]: value } }));

  const save = async () => {
    setSaving(true);
    try {
      for (const [k, vals] of Object.entries(edited)) {
        const [st, ps] = k.split("|");
        const row = { service_type: st as ServiceType, position: (ps || null) as ServicePosition | null, custom_name: null,
          interval_miles: vals.miles ? Number(vals.miles) : null, interval_months: vals.months ? Number(vals.months) : null };
        if (fleetMode) await upsertFleetIntervalDefault(row);
        else await upsertInterval({ vehicle_id: vehicleId!, ...row });
      }
      toast.success(fleetMode ? "Fleet intervals saved — applied to all vans" : "Intervals saved");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setSaving(false); }
  };

  const reset = async (id: string) => {
    try { await deleteInterval(id); load(); onSaved(); } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{fleetMode ? "Service intervals — all vans" : `Service intervals — ${vehicleReg}`}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {fleetMode ? "These apply to every van unless a van has its own setting." : "Changes here apply to this van only. Use Reset to go back to the fleet setting."}
        </p>
        {loading ? <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div> : (
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr,90px,90px] gap-2 text-xs font-medium text-muted-foreground"><div>Service</div><div>Miles</div><div>Months</div></div>
            {rows.map((r) => {
              const e = edited[r.key];
              return (
                <div key={r.key} className="grid grid-cols-[1fr,90px,90px] items-center gap-2">
                  <div className="flex flex-wrap items-center gap-1 text-sm">
                    {formatServiceLabel(r.serviceType, r.position, null)}
                    {!fleetMode && (r.override
                      ? <><Badge variant="secondary">This van only</Badge><Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => reset(r.override!.id)}>Reset</Button></>
                      : <span className="text-xs text-muted-foreground">fleet setting</span>)}
                  </div>
                  <Input type="number" value={e?.miles ?? r.miles} onChange={(ev) => change(r.key, r, "miles", ev.target.value)} placeholder="—" />
                  <Input type="number" value={e?.months ?? r.months} onChange={(ev) => change(r.key, r, "months", ev.target.value)} placeholder="—" />
                </div>
              );
            })}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving || Object.keys(edited).length === 0}>{saving ? "Saving..." : "Save changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MaintenanceIntervalsDialog;
