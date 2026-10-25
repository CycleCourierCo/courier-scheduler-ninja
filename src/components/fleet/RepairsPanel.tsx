import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Paperclip, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listRepairs, listProviders, saveRepair, type RepairJob, type RepairProvider } from "@/services/fleetRepairService";
import { listDefects, uploadFleetFile, openFleetFile, type Defect } from "@/services/fleetInspectionService";
import { REPAIR_STATUSES, repairStatusLabel, repairVerifyError, isRepairOutstanding, repairCost } from "@/lib/fleet/repairs";
import { isDefectOpen } from "@/lib/fleet/defects";

const db = supabase as any;
const DONE = ["completed", "invoiced", "verified", "closed"];
const money = (n: number) => n.toLocaleString("en-GB", { style: "currency", currency: "GBP" });
const num = (v: string) => (v === "" ? null : Number(v));

export default function RepairsPanel({ vehicleId, onChange }: { vehicleId: string; onChange?: () => void }) {
  const [rows, setRows] = useState<RepairJob[]>([]);
  const [providers, setProviders] = useState<RepairProvider[]>([]);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [intervals, setIntervals] = useState<any[]>([]);
  const [edit, setEdit] = useState<Partial<RepairJob> | null>(null);
  const [orig, setOrig] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => listRepairs(vehicleId).then(setRows).catch((e) => toast.error(e.message));
  useEffect(() => {
    load();
    listProviders().then(setProviders).catch(() => {});
    listDefects(vehicleId).then(setDefects).catch(() => {});
    db.from("vehicle_maintenance_intervals").select("*").eq("vehicle_id", vehicleId).then(({ data }: any) => setIntervals(data ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId]);

  const open = (r: Partial<RepairJob>) => { setEdit(r); setOrig(r.status ?? null); };
  const intervalName = (i: any) => i.custom_name || `${i.service_type.replace(/_/g, " ")}${i.position ? ` (${i.position.replace(/_/g, " ")})` : ""}`;

  const save = async () => {
    if (!edit?.title?.trim()) return toast.error("Give the repair a title");
    const err = repairVerifyError(edit as RepairJob); if (err) return toast.error(err);
    setSaving(true);
    try {
      const { id, created_at: _c, ...rest } = edit as RepairJob;
      await saveRepair(id ? { id, ...rest } : { ...rest, vehicle_id: vehicleId });
      // Finishing a scheduled maintenance item rolls its schedule forward via a service record (no cost: the repair holds it).
      const nowDone = DONE.includes(edit.status ?? "") && !DONE.includes(orig ?? "");
      const iv = intervals.find((i) => i.id === edit.interval_id);
      if (nowDone && iv) {
        let jobId = id;
        if (!jobId) { const { data } = await db.from("fleet_repair_jobs").select("id").eq("vehicle_id", vehicleId).order("created_at", { ascending: false }).limit(1); jobId = data?.[0]?.id; }
        const { error } = await db.from("vehicle_maintenance_logs").insert({
          vehicle_id: vehicleId, service_type: iv.service_type, position: iv.position, custom_name: iv.custom_name,
          service_date: new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" }), odometer_mi: edit.odometer_mi ?? null,
          vendor: providers.find((p) => p.id === edit.provider_id)?.name ?? null, notes: `From repair: ${edit.title}`, repair_job_id: jobId ?? null,
        });
        if (error) toast.error(`Repair saved, but the service history wasn't updated — ${error.message}`);
      }
      toast.success("Repair saved"); setEdit(null); load(); onChange?.();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  const attachInvoice = async (f?: File) => {
    if (!f || !edit) return;
    try { const up = await uploadFleetFile(vehicleId, f); setEdit({ ...edit, invoice_path: up.path }); }
    catch (e) { toast.error(`Upload failed — ${(e as Error).message}`); }
  };

  const set = (k: keyof RepairJob, v: any) => setEdit((e) => ({ ...e!, [k]: v }));

  return (
    <Card className="p-3 space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => open({ status: "requested" })}><Plus className="h-4 w-4 mr-1" />New repair job</Button>
        <Button size="sm" variant="ghost" asChild><Link to="/fleet/garages">Garages</Link></Button>
      </div>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">No repair jobs yet.</p> : (
        <ul className="divide-y text-sm">
          {rows.map((r) => (
            <li key={r.id}>
              <button className="w-full text-left py-2 flex items-start justify-between gap-2" onClick={() => open(r)}>
                <span className="min-w-0">
                  <span className="block font-medium truncate">{r.title}</span>
                  <span className="block text-xs text-muted-foreground">{[providers.find((p) => p.id === r.provider_id)?.name, r.booked_for && `Booked ${r.booked_for}`, repairCost(r) ? money(repairCost(r)) : null].filter(Boolean).join(" · ")}</span>
                </span>
                <Badge variant={isRepairOutstanding(r.status) ? "secondary" : "outline"}>{repairStatusLabel(r.status)}</Badge>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edit?.id ? "Repair job" : "New repair job"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div className="space-y-1"><Label htmlFor="rt">Title</Label><Input id="rt" value={edit.title ?? ""} onChange={(e) => set("title", e.target.value)} /></div>
              <div className="space-y-1"><Label htmlFor="rd">Details</Label><Textarea id="rd" rows={2} value={edit.description ?? ""} onChange={(e) => set("description", e.target.value)} /></div>
              <div className="space-y-1"><Label>Status</Label>
                <Select value={edit.status} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{REPAIR_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="space-y-1"><Label>Fixes defect</Label>
                <Select value={edit.defect_id ?? "none"} onValueChange={(v) => { const d = defects.find((x) => x.id === v); setEdit({ ...edit, defect_id: v === "none" ? null : v, title: edit.title || d?.title }); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">None</SelectItem>{defects.filter((d) => isDefectOpen(d.status) || d.id === edit.defect_id).map((d) => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="space-y-1"><Label>Scheduled maintenance item</Label>
                <Select value={edit.interval_id ?? "none"} onValueChange={(v) => set("interval_id", v === "none" ? null : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">None (ad hoc)</SelectItem>{intervals.map((i) => <SelectItem key={i.id} value={i.id}>{intervalName(i)}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="space-y-1"><Label>Garage</Label>
                <Select value={edit.provider_id ?? "none"} onValueChange={(v) => set("provider_id", v === "none" ? null : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">Not chosen</SelectItem>{providers.filter((p) => p.active || p.id === edit.provider_id).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label htmlFor="bk">Booked for</Label><Input id="bk" type="date" value={edit.booked_for ?? ""} onChange={(e) => set("booked_for", e.target.value || null)} /></div>
                <div className="space-y-1"><Label htmlFor="om">Mileage at repair</Label><Input id="om" type="number" inputMode="numeric" value={edit.odometer_mi ?? ""} onChange={(e) => set("odometer_mi", num(e.target.value))} /></div>
                {(["quoted_cost", "labour_cost", "parts_cost", "vat", "final_cost"] as const).map((k) => (
                  <div key={k} className="space-y-1"><Label htmlFor={k}>{{ quoted_cost: "Quote £", labour_cost: "Labour £", parts_cost: "Parts £", vat: "VAT £", final_cost: "Final cost £" }[k]}</Label>
                    <Input id={k} type="number" step="0.01" inputMode="decimal" value={edit[k] ?? ""} onChange={(e) => set(k, num(e.target.value))} /></div>
                ))}
                <div className="space-y-1"><Label htmlFor="ir">Invoice ref</Label><Input id="ir" value={edit.invoice_ref ?? ""} onChange={(e) => set("invoice_ref", e.target.value)} /></div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                {edit.invoice_path && <button className="underline" onClick={() => openFleetFile(edit.invoice_path!).catch((e) => toast.error(e.message))}>View invoice</button>}
                <label className="inline-flex items-center gap-1 cursor-pointer underline"><Paperclip className="h-4 w-4" />{edit.invoice_path ? "Replace invoice" : "Attach invoice"}
                  <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => attachInvoice(e.target.files?.[0])} /></label>
              </div>
              <div className="space-y-1"><Label htmlFor="vb">Verified by (needed to verify or close)</Label><Input id="vb" value={edit.verified_by_name ?? ""} onChange={(e) => set("verified_by_name", e.target.value)} /></div>
            </div>
          )}
          <DialogFooter><Button onClick={save} disabled={saving}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
