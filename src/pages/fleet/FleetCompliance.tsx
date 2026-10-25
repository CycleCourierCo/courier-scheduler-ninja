import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { loadFleetOverview, type FleetVehicleSummary } from "@/services/fleetService";
import { dueState, fleetStatusGroup } from "@/lib/fleet/status";
import { SEVERITY_RAG } from "@/lib/fleet/defects";
import { repairStatusLabel } from "@/lib/fleet/repairs";

const db = supabase as any;
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
type Row = { id: string; reg: string; text: string; when?: string | null; tone: "bad" | "warn" | "ok" };

const Section = ({ title, rows, empty }: { title: string; rows: Row[]; empty: string }) => (
  <Card className="p-3 space-y-2">
    <h2 className="font-semibold">{title} <span className="text-muted-foreground font-normal">({rows.length})</span></h2>
    {rows.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : (
      <ul className="divide-y text-sm">
        {rows.map((r, i) => (
          <li key={i}><Link to={`/fleet/vehicles/${r.id}`} className="flex justify-between gap-2 py-1.5 hover:underline">
            <span className="min-w-0 truncate"><span className="font-mono font-medium">{r.reg}</span> · {r.text}</span>
            <span className={`shrink-0 ${r.tone === "bad" ? "text-destructive font-medium" : r.tone === "warn" ? "text-status-waiting font-medium" : "text-muted-foreground"}`}>{fmt(r.when)}</span>
          </Link></li>
        ))}
      </ul>
    )}
  </Card>
);

const FleetCompliance = () => {
  const [rows, setRows] = useState<FleetVehicleSummary[]>([]);
  const [insps, setInsps] = useState<any[]>([]);
  const [defects, setDefects] = useState<any[]>([]);
  const [repairs, setRepairs] = useState<any[]>([]);
  const [acks, setAcks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    Promise.all([
      loadFleetOverview(),
      db.from("fleet_inspections").select("id, vehicle_id, inspection_type, inspected_at, overall_result").eq("status", "final").gte("inspected_at", since).order("inspected_at", { ascending: false }),
      db.from("vehicle_issues").select("id, vehicle_id, title, severity, status, created_at").not("status", "in", "(resolved,cancelled)"),
      db.from("fleet_repair_jobs").select("id, vehicle_id, title, status, booked_for").not("status", "in", "(verified,closed,cancelled)"),
      db.from("fleet_route_warning_acks").select("vehicle_id, context, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(50),
    ]).then(([o, i, d, r, a]: any[]) => {
      setRows(o.rows); setInsps(i.data ?? []); setDefects(d.data ?? []); setRepairs(r.data ?? []); setAcks(a.data ?? []);
    }).catch((e) => toast.error(`Couldn't load compliance — ${(e as Error).message}`)).finally(() => setLoading(false));
  }, []);

  const s = useMemo(() => {
    const active = rows.filter((r) => fleetStatusGroup(r.vehicle.status) !== "retired");
    const reg = new Map(rows.map((r) => [r.vehicle.id, r.vehicle.registration]));
    const out = { inspDue: [] as Row[], inspOver: [] as Row[], done: [] as Row[], failed: [] as Row[], defects: [] as Row[], repairs: [] as Row[], maintDue: [] as Row[], maintOver: [] as Row[], expiry: [] as Row[], acks: [] as Row[] };
    for (const r of active) {
      const v: any = r.vehicle; const base = { id: v.id, reg: v.registration };
      const ins = dueState(v.next_inspection_due, 7);
      if (!v.next_inspection_due) out.inspOver.push({ ...base, text: "No inspection recorded", tone: "bad" });
      else if (ins === "overdue") out.inspOver.push({ ...base, text: "Safety inspection overdue", when: v.next_inspection_due, tone: "bad" });
      else if (ins === "due_soon") out.inspDue.push({ ...base, text: "Safety inspection due", when: v.next_inspection_due, tone: "warn" });
      for (const d of r.due) {
        if (d.status === "red") out.maintOver.push({ ...base, text: d.label, when: d.dueDate, tone: "bad" });
        else if (d.status === "amber") out.maintDue.push({ ...base, text: d.label, when: d.dueDate, tone: "warn" });
      }
      for (const [label, date] of [["MOT", v.mot_expiry_date], ["Road tax", v.tax_due_date], ["Insurance", r.insuranceEnd]] as const) {
        const st = dueState(date, days);
        if (!date && label === "Insurance") out.expiry.push({ ...base, text: "No current insurance", tone: "bad" });
        else if (st === "overdue") out.expiry.push({ ...base, text: `${label} expired`, when: date, tone: "bad" });
        else if (st === "due_soon") out.expiry.push({ ...base, text: `${label} due`, when: date, tone: "warn" });
      }
    }
    for (const i of insps) {
      const row: Row = { id: i.vehicle_id, reg: reg.get(i.vehicle_id) ?? "", text: i.inspection_type.replace(/_/g, " "), when: i.inspected_at, tone: i.overall_result === "fail" ? "bad" : "ok" };
      (i.overall_result === "fail" ? out.failed : out.done).push(row);
    }
    for (const d of [...defects].sort((a, b) => ({ high: 0, medium: 1, low: 2 } as any)[a.severity] - ({ high: 0, medium: 1, low: 2 } as any)[b.severity]))
      out.defects.push({ id: d.vehicle_id, reg: reg.get(d.vehicle_id) ?? "", text: `${SEVERITY_RAG[d.severity as "high"]?.label ?? d.severity}: ${d.title}`, when: d.created_at, tone: d.severity === "high" ? "bad" : d.severity === "medium" ? "warn" : "ok" });
    for (const j of repairs) out.repairs.push({ id: j.vehicle_id, reg: reg.get(j.vehicle_id) ?? "", text: `${j.title} — ${repairStatusLabel(j.status)}`, when: j.booked_for, tone: j.booked_for && dueState(j.booked_for, 0) === "overdue" ? "bad" : "warn" });
    for (const a of acks) out.acks.push({ id: a.vehicle_id, reg: reg.get(a.vehicle_id) ?? "", text: `Red warning acknowledged (${a.context.replace(/_/g, " ")})`, when: a.created_at, tone: "warn" });
    for (const k of ["expiry", "maintDue", "maintOver", "inspDue"] as const) out[k].sort((a, b) => (a.when ?? "").localeCompare(b.when ?? ""));
    return out;
  }, [rows, insps, defects, repairs, acks, days]);

  const sev = (k: string) => defects.filter((d) => d.severity === k).length;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 space-y-4">
        <Link to="/fleet" className="inline-flex items-center text-sm text-muted-foreground hover:underline"><ChevronLeft className="h-4 w-4" /> Fleet dashboard</Link>
        <h1 className="text-2xl font-bold">Fleet compliance</h1>
        {loading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : (
          <>
            <div className="flex flex-wrap gap-2 items-center text-sm">
              <Badge variant="destructive">Red {sev("high")}</Badge><Badge variant="secondary">Amber {sev("medium")}</Badge><Badge variant="outline">Green {sev("low")}</Badge>
              <span className="ml-auto text-muted-foreground">Expiries within</span>
              {[7, 30, 60].map((d) => <Button key={d} size="sm" variant={days === d ? "default" : "outline"} onClick={() => setDays(d)}>{d} days</Button>)}
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <Section title="Inspections overdue" rows={s.inspOver} empty="None overdue." />
              <Section title="Inspections due in 7 days" rows={s.inspDue} empty="None due." />
              <Section title="Failed inspections (last 30 days)" rows={s.failed} empty="No failures." />
              <Section title="Completed inspections (last 30 days)" rows={s.done} empty="None completed." />
              <Section title="Open defects" rows={s.defects} empty="No open defects." />
              <Section title="Outstanding repairs" rows={s.repairs} empty="No outstanding repairs." />
              <Section title="Maintenance overdue" rows={s.maintOver} empty="Nothing overdue." />
              <Section title="Maintenance due soon" rows={s.maintDue} empty="Nothing due soon." />
              <Section title={`MOT, tax and insurance (${days} days)`} rows={s.expiry} empty="Nothing expiring." />
              <Section title="Red warnings continued past (last 30 days)" rows={s.acks} empty="None recorded." />
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default FleetCompliance;
