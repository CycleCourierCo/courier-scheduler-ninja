import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { listTyres, saveTyre, replaceTyre, getFleetSettings, type Tyre } from "@/services/fleetRepairService";
import { TYRE_POSITIONS } from "@/lib/fleet/repairs";
import { LEGAL_TREAD_MM } from "@/lib/fleet/inspections";

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });

export default function TyresPanel({ vehicleId }: { vehicleId: string }) {
  const [rows, setRows] = useState<Tyre[]>([]);
  const [warn, setWarn] = useState(3);
  const [edit, setEdit] = useState<{ mode: "fit" | "edit" | "replace"; tyre: Partial<Tyre>; old?: Tyre; reason?: string } | null>(null);

  const load = () => listTyres(vehicleId).then(setRows).catch((e) => toast.error(e.message));
  useEffect(() => { load(); getFleetSettings().then((s) => setWarn(Number(s.tread_warn_mm))); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [vehicleId]);

  const current = (pos: string) => rows.find((t) => t.position === pos && !t.removed_date);
  const history = rows.filter((t) => t.removed_date);

  const save = async () => {
    if (!edit) return;
    const t = { ...edit.tyre };
    try {
      if (edit.mode === "replace" && edit.old) await replaceTyre(edit.old, t, edit.reason ?? "");
      else await saveTyre(edit.mode === "fit" ? { ...t, vehicle_id: vehicleId } : t);
      toast.success("Tyre saved"); setEdit(null); load();
    } catch (e) { toast.error((e as Error).message); }
  };

  const tread = (mm: number | null) => {
    if (mm == null) return <Badge variant="outline">No reading</Badge>;
    if (mm < LEGAL_TREAD_MM) return <Badge variant="destructive">{mm}mm · illegal</Badge>;
    if (mm <= warn) return <Badge variant="secondary">{mm}mm · low</Badge>;
    return <Badge variant="outline">{mm}mm</Badge>;
  };
  const set = (k: keyof Tyre, v: any) => setEdit((e) => e && { ...e, tyre: { ...e.tyre, [k]: v } });
  const n = (v: string) => (v === "" ? null : Number(v));

  return (
    <Card className="p-3 space-y-3">
      <p className="text-xs text-muted-foreground">Tread updates automatically when a safety inspection is finalised. Warning at {warn}mm, illegal under {LEGAL_TREAD_MM}mm.</p>
      <ul className="divide-y text-sm">
        {TYRE_POSITIONS.map((p) => {
          const t = current(p.value);
          return (
            <li key={p.value} className="py-2 flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0">
                <span className="block font-medium">{p.label}</span>
                <span className="block text-xs text-muted-foreground">{t ? [t.brand, t.size, t.fitted_date && `fitted ${t.fitted_date}`, t.fitted_odometer_mi && `${t.fitted_odometer_mi.toLocaleString("en-GB")} mi`].filter(Boolean).join(" · ") || "Details not entered" : "No tyre recorded"}</span>
              </span>
              <span className="flex items-center gap-2">
                {t && tread(t.last_tread_mm)}
                {t ? <>
                  <Button size="sm" variant="ghost" onClick={() => setEdit({ mode: "edit", tyre: t })}>Edit</Button>
                  <Button size="sm" variant="outline" onClick={() => setEdit({ mode: "replace", old: t, tyre: { fitted_date: today() } })}>Replace</Button>
                </> : <Button size="sm" variant="outline" onClick={() => setEdit({ mode: "fit", tyre: { position: p.value, fitted_date: today() } })}>Add</Button>}
              </span>
            </li>
          );
        })}
      </ul>
      {history.length > 0 && (
        <details className="text-sm"><summary className="cursor-pointer text-muted-foreground">Replaced tyres ({history.length})</summary>
          <ul className="mt-2 space-y-1">{history.map((t) => (
            <li key={t.id} className="text-xs">{TYRE_POSITIONS.find((p) => p.value === t.position)?.label}: {[t.brand, t.fitted_date, `removed ${t.removed_date}`, t.removal_reason, t.cost != null && `£${t.cost}`].filter(Boolean).join(" · ")}</li>
          ))}</ul>
        </details>
      )}

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edit?.mode === "replace" ? "Replace tyre" : edit?.mode === "fit" ? "Add tyre" : "Edit tyre"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="grid grid-cols-2 gap-2">
              {edit.mode === "replace" && <div className="col-span-2 space-y-1"><Label htmlFor="rr">Why was it replaced?</Label><Input id="rr" value={edit.reason ?? ""} onChange={(e) => setEdit({ ...edit, reason: e.target.value })} placeholder="e.g. Worn to 2mm, puncture" /></div>}
              <div className="space-y-1"><Label htmlFor="tb">Brand</Label><Input id="tb" value={edit.tyre.brand ?? ""} onChange={(e) => set("brand", e.target.value)} /></div>
              <div className="space-y-1"><Label htmlFor="ts">Size</Label><Input id="ts" value={edit.tyre.size ?? ""} onChange={(e) => set("size", e.target.value)} placeholder="215/65 R16C" /></div>
              <div className="space-y-1"><Label htmlFor="tf">Fitted</Label><Input id="tf" type="date" value={edit.tyre.fitted_date ?? ""} onChange={(e) => set("fitted_date", e.target.value || null)} /></div>
              <div className="space-y-1"><Label htmlFor="to">Mileage when fitted</Label><Input id="to" type="number" value={edit.tyre.fitted_odometer_mi ?? ""} onChange={(e) => set("fitted_odometer_mi", n(e.target.value))} /></div>
              <div className="space-y-1"><Label htmlFor="tt">Tread (mm)</Label><Input id="tt" type="number" step="0.1" value={edit.tyre.last_tread_mm ?? ""} onChange={(e) => { set("last_tread_mm", n(e.target.value)); set("last_inspected_at", today()); }} /></div>
              <div className="space-y-1"><Label htmlFor="tc">Cost £</Label><Input id="tc" type="number" step="0.01" value={edit.tyre.cost ?? ""} onChange={(e) => set("cost", n(e.target.value))} /></div>
              <div className="col-span-2 space-y-1"><Label htmlFor="tsu">Supplier</Label><Input id="tsu" value={edit.tyre.supplier ?? ""} onChange={(e) => set("supplier", e.target.value)} /></div>
            </div>
          )}
          <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
