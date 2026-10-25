import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Truck } from "lucide-react";
import { toast } from "sonner";
import { loadFleetOverview, describeAudit, type FleetAuditRow, type FleetVehicleSummary } from "@/services/fleetService";
import { dueState, fleetStatusGroup, FLEET_GROUP_LABEL, type FleetStatusGroup } from "@/lib/fleet/status";
import VehicleStatusBadge from "@/components/vehicles/VehicleStatusBadge";

type Filter = "all" | "operational" | "under_repair" | "out_of_service" | "critical" | "issues" | "service_soon" | "service_overdue" | "mot_soon" | "inspection_due" | "inspection_overdue" | "actions";

const Stat = ({ label, value, tone, active, onClick }: { label: string; value: number; tone?: "bad" | "warn"; active: boolean; onClick: () => void }) => (
  <button type="button" onClick={onClick} className={`text-left rounded-lg border p-3 transition-colors hover:bg-muted ${active ? "ring-2 ring-primary" : ""}`}>
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className={`text-2xl font-bold ${value && tone === "bad" ? "text-destructive" : value && tone === "warn" ? "text-status-waiting" : ""}`}>{value}</div>
  </button>
);

const FleetDashboard = () => {
  const [rows, setRows] = useState<FleetVehicleSummary[]>([]);
  const [recent, setRecent] = useState<FleetAuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [window, setWindow] = useState(30);

  useEffect(() => {
    loadFleetOverview()
      .then((r) => { setRows(r.rows); setRecent(r.recent); })
      .catch((e) => toast.error(`Couldn't load the fleet — ${(e as Error).message}`))
      .finally(() => setLoading(false));
  }, []);

  const active = useMemo(() => rows.filter((r) => fleetStatusGroup(r.vehicle.status) !== "retired"), [rows]);

  const tests: Record<Filter, (r: FleetVehicleSummary) => boolean> = {
    all: () => true,
    operational: (r) => ["operational", "maintenance_required"].includes(fleetStatusGroup(r.vehicle.status)),
    under_repair: (r) => fleetStatusGroup(r.vehicle.status) === "under_repair",
    out_of_service: (r) => fleetStatusGroup(r.vehicle.status) === "out_of_service",
    critical: (r) => r.openIssues.some((i) => i.severity === "high"),
    issues: (r) => r.openIssues.some((i) => i.severity !== "high"),
    service_soon: (r) => r.due.some((d) => d.status === "amber"),
    service_overdue: (r) => r.due.some((d) => d.status === "red"),
    mot_soon: (r) => ["overdue", "due_soon"].includes(dueState(r.vehicle.mot_expiry_date, 30)),
    inspection_due: (r) => dueState((r.vehicle as any).next_inspection_due, 7) === "due_soon",
    inspection_overdue: (r) => dueState((r.vehicle as any).next_inspection_due, 7) === "overdue",
    actions: (r) => r.openIssues.length > 0 || r.due.some((d) => d.status === "red" || d.status === "amber") || fleetStatusGroup(r.vehicle.status) === "maintenance_required",
  };
  const count = (f: Filter) => active.filter(tests[f]).length;

  const statusCounts = useMemo(() => {
    const c: Partial<Record<FleetStatusGroup, number>> = {};
    for (const r of rows) { const g = fleetStatusGroup(r.vehicle.status); c[g] = (c[g] ?? 0) + 1; }
    return c;
  }, [rows]);

  const upcoming = useMemo(() => {
    const items: { reg: string; id: string; label: string; when: string }[] = [];
    for (const r of active) {
      for (const d of r.due) {
        if (d.dueDate && dueState(d.dueDate, window) === "due_soon") items.push({ reg: r.vehicle.registration, id: r.vehicle.id, label: d.label, when: d.dueDate });
      }
      for (const [label, date] of [["MOT", r.vehicle.mot_expiry_date], ["Tax", r.vehicle.tax_due_date], ["Insurance", r.insuranceEnd], ["Safety inspection", (r.vehicle as any).next_inspection_due]] as const) {
        if (date && dueState(date, window) === "due_soon") items.push({ reg: r.vehicle.registration, id: r.vehicle.id, label, when: date });
      }
    }
    return items.sort((a, b) => a.when.localeCompare(b.when));
  }, [active, window]);

  const list = active
    .filter(tests[filter])
    .filter((r) => !search || `${r.vehicle.registration} ${r.vehicle.make ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  const regOf = (id: string | null) => rows.find((r) => r.vehicle.id === id)?.vehicle.registration ?? "";
  const toggle = (f: Filter) => setFilter((cur) => (cur === f ? "all" : f));

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-2">
          <Truck className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Fleet dashboard</h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <Stat label="Total vehicles" value={active.length} active={filter === "all"} onClick={() => setFilter("all")} />
              <Stat label="Operational" value={count("operational")} active={filter === "operational"} onClick={() => toggle("operational")} />
              <Stat label="Under repair" value={count("under_repair")} tone="warn" active={filter === "under_repair"} onClick={() => toggle("under_repair")} />
              <Stat label="Out of service" value={count("out_of_service")} tone="bad" active={filter === "out_of_service"} onClick={() => toggle("out_of_service")} />
              <Stat label="Inspections due (7 days)" value={count("inspection_due")} tone="warn" active={filter === "inspection_due"} onClick={() => toggle("inspection_due")} />
              <Stat label="Overdue inspections" value={count("inspection_overdue")} tone="bad" active={filter === "inspection_overdue"} onClick={() => toggle("inspection_overdue")} />
              <Stat label="Critical issues open" value={count("critical")} tone="bad" active={filter === "critical"} onClick={() => toggle("critical")} />
              <Stat label="Other issues open" value={count("issues")} tone="warn" active={filter === "issues"} onClick={() => toggle("issues")} />
              <Stat label="Service due soon" value={count("service_soon")} tone="warn" active={filter === "service_soon"} onClick={() => toggle("service_soon")} />
              <Stat label="Service overdue" value={count("service_overdue")} tone="bad" active={filter === "service_overdue"} onClick={() => toggle("service_overdue")} />
              <Stat label="MOT within 30 days" value={count("mot_soon")} tone="warn" active={filter === "mot_soon"} onClick={() => toggle("mot_soon")} />
              <Stat label="Vans with open actions" value={count("actions")} tone="warn" active={filter === "actions"} onClick={() => toggle("actions")} />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="p-3 space-y-3 lg:col-span-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">Vehicles</h2>
                  {filter !== "all" && <Badge variant="secondary" className="cursor-pointer" onClick={() => setFilter("all")}>Filtered · clear</Badge>}
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search registration or make" className="ml-auto max-w-xs" />
                </div>
                {list.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No vehicles match.</p>
                ) : (
                  <ul className="divide-y">
                    {list.map((r) => {
                      const crit = r.openIssues.filter((i) => i.severity === "high").length;
                      const overdue = r.due.filter((d) => d.status === "red").length;
                      return (
                        <li key={r.vehicle.id}>
                          <Link to={`/fleet/vehicles/${r.vehicle.id}`} className="flex flex-wrap items-center gap-2 py-2 hover:bg-muted rounded px-1">
                            <span className="font-mono font-bold">{r.vehicle.registration}</span>
                            <span className="text-xs text-muted-foreground">{r.vehicle.make ?? ""}</span>
                            <VehicleStatusBadge status={r.vehicle.status} />
                            <span className="ml-auto flex gap-1 text-xs">
                              {crit > 0 && <Badge variant="destructive">{crit} critical</Badge>}
                              {r.openIssues.length - crit > 0 && <Badge variant="secondary">{r.openIssues.length - crit} issues</Badge>}
                              {overdue > 0 && <Badge variant="destructive">{overdue} service overdue</Badge>}
                              <span className="text-muted-foreground">{r.odometer.toLocaleString("en-GB")} mi</span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>

              <div className="space-y-4">
                <Card className="p-3 space-y-2">
                  <h2 className="font-semibold">Status overview</h2>
                  {(Object.keys(FLEET_GROUP_LABEL) as FleetStatusGroup[]).map((g) => (
                    <div key={g} className="flex justify-between text-sm"><span>{FLEET_GROUP_LABEL[g]}</span><span className="font-medium">{statusCounts[g] ?? 0}</span></div>
                  ))}
                </Card>

                <Card className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold">Coming up</h2>
                    <div className="ml-auto flex gap-1">
                      {[7, 14, 30].map((d) => (
                        <button key={d} type="button" onClick={() => setWindow(d)} className={`rounded px-2 text-xs border ${window === d ? "bg-primary text-primary-foreground" : ""}`}>{d}d</button>
                      ))}
                    </div>
                  </div>
                  {upcoming.length === 0 ? <p className="text-sm text-muted-foreground">Nothing due in the next {window} days.</p> : (
                    <ul className="space-y-1 text-sm">
                      {upcoming.map((u, i) => (
                        <li key={i}><Link to={`/fleet/vehicles/${u.id}`} className="flex justify-between gap-2 hover:underline"><span><span className="font-mono">{u.reg}</span> · {u.label}</span><span className="text-muted-foreground">{new Date(u.when).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span></Link></li>
                      ))}
                    </ul>
                  )}
                </Card>

                <Card className="p-3 space-y-2">
                  <h2 className="font-semibold">Recent activity</h2>
                  {recent.length === 0 ? <p className="text-sm text-muted-foreground">No activity recorded yet.</p> : (
                    <ul className="space-y-1 text-sm">
                      {recent.map((a) => (
                        <li key={a.id} className="flex justify-between gap-2">
                          <span className="min-w-0 truncate"><span className="font-mono">{regOf(a.vehicle_id)}</span> {describeAudit(a)}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" })}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default FleetDashboard;
