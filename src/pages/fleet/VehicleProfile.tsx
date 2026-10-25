import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, ChevronLeft, Loader2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { VEHICLE_STATUS_OPTIONS, type Vehicle } from "@/services/vehicleService";
import { loadFleetOverview, loadVehicleAudit, describeAudit, type FleetAuditRow, type FleetVehicleSummary } from "@/services/fleetService";
import VehicleStatusBadge from "@/components/vehicles/VehicleStatusBadge";
import VehicleIssuesDialog from "@/components/vehicles/VehicleIssuesDialog";
import VehicleMaintenanceDialog from "@/components/vehicles/VehicleMaintenanceDialog";
import { dueState } from "@/lib/fleet/status";
import InspectionsPanel from "@/components/fleet/InspectionsPanel";
import DefectsPanel from "@/components/fleet/DefectsPanel";
import RepairsPanel from "@/components/fleet/RepairsPanel";
import TyresPanel from "@/components/fleet/TyresPanel";
import CostsPanel from "@/components/fleet/CostsPanel";

const db = supabase as any;
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

const DueLine = ({ label, date, soon = 30 }: { label: string; date: string | null | undefined; soon?: number }) => {
  const s = dueState(date, soon);
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={s === "overdue" ? "text-destructive font-medium" : s === "due_soon" ? "text-status-waiting font-medium" : ""}>{fmt(date)}</span>
    </div>
  );
};

const VehicleProfile = () => {
  const { id = "" } = useParams();
  const [summary, setSummary] = useState<FleetVehicleSummary | null>(null);
  const [audit, setAudit] = useState<FleetAuditRow[]>([]);
  const [drivers, setDrivers] = useState<{ id: string; name: string | null }[]>([]);
  const [form, setForm] = useState<Partial<Vehicle>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [maintOpen, setMaintOpen] = useState(false);

  const load = async () => {
    try {
      const [o, a] = await Promise.all([loadFleetOverview(), loadVehicleAudit(id)]);
      const s = o.rows.find((r) => r.vehicle.id === id) ?? null;
      setSummary(s);
      setAudit(a);
      if (s) setForm(s.vehicle);
    } catch (e) {
      toast.error(`Couldn't load this vehicle — ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    db.from("profiles").select("id, name").eq("role", "driver").order("name").then(({ data }: any) => setDrivers(data ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    const f: any = form;
    const { error } = await db.from("vehicles").update({
      status: f.status,
      model: f.model || null,
      vin: f.vin || null,
      vehicle_type: f.vehicle_type || null,
      assigned_driver_id: f.assigned_driver_id || null,
      maintenance_notes: f.maintenance_notes || null,
      next_inspection_due: f.next_inspection_due || null,
      notes: f.notes || null,
    }).eq("id", id);
    setSaving(false);
    if (error) return toast.error(`Couldn't save — ${error.message}`);
    toast.success("Vehicle saved");
    load();
  };

  if (loading) return <Layout><div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></Layout>;
  if (!summary) return <Layout><div className="container mx-auto px-4 py-6"><p>Vehicle not found, or you don't have access.</p><Link to="/fleet" className="underline">Back to fleet</Link></div></Layout>;

  const v = summary.vehicle as any;
  const f = form as any;
  const crit = summary.openIssues.filter((i) => i.severity === "high");
  const dueSoon = summary.due.filter((d) => d.status === "red" || d.status === "amber");

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 space-y-4">
        <Link to="/fleet" className="inline-flex items-center text-sm text-muted-foreground hover:underline"><ChevronLeft className="h-4 w-4" /> Fleet dashboard</Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-mono text-2xl font-bold">{v.registration}</h1>
          <VehicleStatusBadge status={v.status} />
          <span className="text-sm text-muted-foreground">{[v.make, v.model, v.year_of_manufacture].filter(Boolean).join(" · ")}</span>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setIssuesOpen(true)}><AlertTriangle className="h-4 w-4 mr-2" />Issues ({summary.openIssues.length})</Button>
            <Button variant="outline" size="sm" onClick={() => setMaintOpen(true)}><Wrench className="h-4 w-4 mr-2" />Service & mileage</Button>
          </div>
        </div>

        {crit.length > 0 && (
          <Card className="border-destructive bg-destructive/10 p-3 text-sm">
            <strong className="text-destructive">Critical issue open:</strong> {crit.map((c) => c.title).join("; ")}. Confirm the van has been assessed and is safe and legal before it is used.
          </Card>
        )}

        <Tabs defaultValue="overview" className="space-y-3">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="inspections">Inspections</TabsTrigger>
            <TabsTrigger value="defects">Defects ({summary.openIssues.length})</TabsTrigger>
            <TabsTrigger value="repairs">Repairs ({summary.openRepairs.length})</TabsTrigger>
            <TabsTrigger value="tyres">Tyres</TabsTrigger>
            <TabsTrigger value="costs">Costs</TabsTrigger>
            <TabsTrigger value="details">Fleet details</TabsTrigger>
            <TabsTrigger value="history">History ({audit.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="inspections"><InspectionsPanel vehicleId={id} odometer={summary.odometer} /></TabsContent>
          <TabsContent value="defects"><DefectsPanel vehicleId={id} onChange={load} /></TabsContent>
          <TabsContent value="repairs"><RepairsPanel vehicleId={id} onChange={load} /></TabsContent>
          <TabsContent value="tyres"><TyresPanel vehicleId={id} /></TabsContent>
          <TabsContent value="costs"><CostsPanel vehicleId={id} reg={v.registration} /></TabsContent>

          <TabsContent value="overview" className="grid gap-3 md:grid-cols-3">
            <Card className="p-3 space-y-1">
              <h2 className="font-semibold mb-1">Compliance</h2>
              <DueLine label={`MOT (${v.mot_status ?? "unknown"})`} date={v.mot_expiry_date} />
              <DueLine label={`Tax (${v.tax_status ?? "unknown"})`} date={v.tax_due_date} />
              <DueLine label="Insurance ends" date={summary.insuranceEnd} />
              <DueLine label="Next safety inspection" date={v.next_inspection_due} soon={7} />
              <p className="pt-1 text-xs text-muted-foreground">MOT and tax come from the DVLA; insurance from the Vehicles page.</p>
            </Card>
            <Card className="p-3 space-y-1">
              <h2 className="font-semibold mb-1">Mileage & servicing</h2>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Current odometer</span><span className="font-medium">{summary.odometer.toLocaleString("en-GB")} mi</span></div>
              {dueSoon.length === 0 ? <p className="text-sm text-muted-foreground">No servicing due soon.</p> : dueSoon.map((d, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>{d.label}</span>
                  <Badge variant={d.status === "red" ? "destructive" : "secondary"}>{d.status === "red" ? "Overdue" : "Due soon"}</Badge>
                </div>
              ))}
            </Card>
            <Card className="p-3 space-y-1">
              <h2 className="font-semibold mb-1">Open issues</h2>
              {summary.openIssues.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : summary.openIssues.map((i) => (
                <div key={i.id} className="flex justify-between gap-2 text-sm">
                  <span className="truncate">{i.title}</span>
                  <Badge variant={i.severity === "high" ? "destructive" : "secondary"}>{i.severity}</Badge>
                </div>
              ))}
            </Card>
          </TabsContent>

          <TabsContent value="details">
            <Card className="p-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={f.status} onValueChange={(x) => set("status", x)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VEHICLE_STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label htmlFor="model">Model</Label><Input id="model" value={f.model ?? ""} onChange={(e) => set("model", e.target.value)} /></div>
              <div className="space-y-1"><Label htmlFor="vin">VIN / chassis number</Label><Input id="vin" value={f.vin ?? ""} onChange={(e) => set("vin", e.target.value.toUpperCase())} /></div>
              <div className="space-y-1"><Label htmlFor="vtype">Vehicle type</Label><Input id="vtype" value={f.vehicle_type ?? ""} onChange={(e) => set("vehicle_type", e.target.value)} placeholder="e.g. LWB panel van" /></div>
              <div className="space-y-1">
                <Label>Assigned driver</Label>
                <Select value={f.assigned_driver_id ?? "none"} onValueChange={(x) => set("assigned_driver_id", x === "none" ? null : x)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not assigned</SelectItem>
                    {drivers.map((d) => <SelectItem key={d.id} value={d.id}>{d.name ?? "Unnamed driver"}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label htmlFor="nid">Next planned safety inspection</Label><Input id="nid" type="date" value={f.next_inspection_due ?? ""} onChange={(e) => set("next_inspection_due", e.target.value)} /></div>
              <div className="space-y-1"><Label>Fuel type</Label><Input value={v.fuel_type ?? ""} disabled /></div>
              <div className="space-y-1"><Label>Purchased</Label><Input value={`${fmt(v.purchase_date)}${v.purchase_mileage ? ` · ${Number(v.purchase_mileage).toLocaleString("en-GB")} mi` : ""}`} disabled /></div>
              <div className="space-y-1 sm:col-span-2"><Label htmlFor="mnotes">Maintenance notes and van-specific requirements</Label><Textarea id="mnotes" rows={3} value={f.maintenance_notes ?? ""} onChange={(e) => set("maintenance_notes", e.target.value)} /></div>
              <div className="space-y-1 sm:col-span-2"><Label htmlFor="notes">General notes</Label><Textarea id="notes" rows={2} value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></div>
              <div className="sm:col-span-2 flex justify-end">
                <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save</Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card className="p-3">
              {audit.length === 0 ? <p className="text-sm text-muted-foreground">No changes recorded yet.</p> : (
                <ul className="divide-y text-sm">
                  {audit.map((a) => (
                    <li key={a.id} className="flex justify-between gap-2 py-2">
                      <span>{describeAudit(a)}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </TabsContent>
        </Tabs>

        <VehicleIssuesDialog vehicleId={id} vehicleReg={v.registration} open={issuesOpen} onOpenChange={(o) => { setIssuesOpen(o); if (!o) load(); }} />
        {maintOpen && (
          <VehicleMaintenanceDialog vehicleId={id} vehicleReg={v.registration} baselineMileage={v.odometer_baseline_mi ?? 0} open={maintOpen} onOpenChange={(o) => { setMaintOpen(o); if (!o) load(); }} />
        )}
      </div>
    </Layout>
  );
};

export default VehicleProfile;
