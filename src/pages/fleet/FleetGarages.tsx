import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { listProviders, saveProvider, getFleetSettings, saveFleetSettings, type RepairProvider, type FleetSettings } from "@/services/fleetRepairService";

const FleetGarages = () => {
  const [rows, setRows] = useState<RepairProvider[]>([]);
  const [draft, setDraft] = useState<Partial<RepairProvider>>({});
  const [s, setS] = useState<FleetSettings | null>(null);

  const load = () => listProviders().then(setRows).catch((e) => toast.error(e.message));
  useEffect(() => { load(); getFleetSettings().then(setS); }, []);

  const add = async () => {
    if (!draft.name?.trim()) return toast.error("Enter the garage name");
    try { await saveProvider({ ...draft, name: draft.name.trim() }); setDraft({}); load(); } catch (e) { toast.error((e as Error).message); }
  };
  const upd = async (p: RepairProvider, patch: Partial<RepairProvider>) => {
    setRows(rows.map((r) => (r.id === p.id ? { ...r, ...patch } : r)));
    try { await saveProvider({ id: p.id, ...patch }); } catch (e) { toast.error((e as Error).message); }
  };
  const saveSettings = async () => {
    if (!s) return;
    try { await saveFleetSettings(s); toast.success("Settings saved"); } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 space-y-4 max-w-3xl">
        <Link to="/fleet" className="inline-flex items-center text-sm text-muted-foreground hover:underline"><ChevronLeft className="h-4 w-4" /> Fleet dashboard</Link>
        <h1 className="text-xl font-bold">Garages and fleet settings</h1>

        <Card className="p-3 space-y-3">
          <h2 className="font-semibold">Garages and repair providers</h2>
          {rows.map((p) => (
            <div key={p.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] items-center border-t pt-2">
              <Input defaultValue={p.name} aria-label="Name" onBlur={(e) => e.target.value.trim() && e.target.value !== p.name && upd(p, { name: e.target.value.trim() })} />
              <Input defaultValue={p.phone ?? ""} placeholder="Phone" aria-label="Phone" onBlur={(e) => e.target.value !== (p.phone ?? "") && upd(p, { phone: e.target.value || null })} />
              <Input defaultValue={p.email ?? ""} placeholder="Email" aria-label="Email" onBlur={(e) => e.target.value !== (p.email ?? "") && upd(p, { email: e.target.value || null })} />
              <label className="flex items-center gap-2 text-xs"><Switch checked={p.active} onCheckedChange={(v) => upd(p, { active: v })} />In use</label>
            </div>
          ))}
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] border-t pt-2">
            <Input placeholder="New garage name" value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <Input placeholder="Phone" value={draft.phone ?? ""} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
            <Input placeholder="Email" value={draft.email ?? ""} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
            <Button onClick={add}>Add</Button>
          </div>
        </Card>

        {s && (
          <Card className="p-3 grid gap-3 sm:grid-cols-2">
            <h2 className="font-semibold sm:col-span-2">Fleet settings</h2>
            <div className="space-y-1"><Label htmlFor="f1">Safety inspection every (days)</Label><Input id="f1" type="number" min={1} value={s.inspection_frequency_days} onChange={(e) => setS({ ...s, inspection_frequency_days: Number(e.target.value) })} /></div>
            <div className="space-y-1"><Label htmlFor="f2">Tyre warning depth (mm)</Label><Input id="f2" type="number" step="0.1" min={1.6} value={s.tread_warn_mm} onChange={(e) => setS({ ...s, tread_warn_mm: Number(e.target.value) })} /></div>
            <div className="space-y-1"><Label htmlFor="f3">Reminder days before due (comma separated)</Label><Input id="f3" value={s.reminder_days.join(", ")} onChange={(e) => setS({ ...s, reminder_days: e.target.value.split(",").map((x) => parseInt(x.trim(), 10)).filter((x) => !Number.isNaN(x)) })} /></div>
            <div className="space-y-1"><Label htmlFor="f4">Mileage warning margin (miles)</Label><Input id="f4" type="number" value={s.mileage_margin_mi} onChange={(e) => setS({ ...s, mileage_margin_mi: Number(e.target.value) })} /></div>
            <div className="sm:col-span-2 flex justify-end"><Button onClick={saveSettings}>Save settings</Button></div>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default FleetGarages;
