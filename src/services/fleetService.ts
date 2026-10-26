import { supabase } from "@/integrations/supabase/client";
import { listVehicles, type Vehicle } from "@/services/vehicleService";
import { listPolicies, type InsurancePolicy } from "@/services/insuranceService";
import { computeNextDue, listFleetIntervalDefaults, type DueItem, type MaintenanceInterval, type MaintenanceLog } from "@/services/vehicleMaintenanceService";
import { effectiveOdometer } from "@/lib/odometer";

const db = supabase as any;

export interface FleetIssue {
  id: string; vehicle_id: string; title: string; description: string | null;
  severity: "low" | "medium" | "high"; status: string; created_at: string;
}
export interface FleetAuditRow {
  id: string; vehicle_id: string | null; table_name: string; record_id: string | null;
  action: string; changes: Record<string, any> | null; actor_id: string | null; created_at: string;
}
export interface FleetVehicleSummary {
  vehicle: Vehicle;
  odometer: number;
  due: DueItem[];
  openIssues: FleetIssue[];
  insuranceEnd: string | null;
  openRepairs: { id: string; title: string; status: string }[];
  lowTyres: { position: string; last_tread_mm: number }[];
}

async function pageAll<T>(build: (from: number, to: number) => any): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function loadFleetOverview(): Promise<{ rows: FleetVehicleSummary[]; recent: FleetAuditRow[]; policies: InsurancePolicy[] }> {
  const [vehicles, policies, logs, intervals, readings, issues, slips, recent, repairs, tyres, settings, fleetDefaults] = await Promise.all([
    listVehicles(),
    listPolicies().catch(() => [] as InsurancePolicy[]),
    pageAll<MaintenanceLog>((a, b) => db.from("vehicle_maintenance_logs").select("*").range(a, b)),
    pageAll<MaintenanceInterval>((a, b) => db.from("vehicle_maintenance_intervals").select("*").range(a, b)),
    pageAll<any>((a, b) => db.from("vehicle_odometer_readings").select("vehicle_id, reading_date, odometer_mi, created_at").range(a, b)),
    pageAll<FleetIssue>((a, b) => db.from("vehicle_issues").select("id, vehicle_id, title, description, severity, status, created_at").not("status", "in", "(resolved,cancelled)").range(a, b)),
    pageAll<any>((a, b) => db.from("timeslips").select("vehicle_id, date, mileage").eq("status", "approved").not("vehicle_id", "is", null).range(a, b)),
    db.from("fleet_audit_log").select("*").order("created_at", { ascending: false }).limit(15).then((r: any) => r.data ?? []),
    pageAll<any>((a, b) => db.from("fleet_repair_jobs").select("id, vehicle_id, title, status").not("status", "in", "(verified,closed,cancelled)").range(a, b)),
    pageAll<any>((a, b) => db.from("fleet_tyres").select("vehicle_id, position, last_tread_mm").is("removed_date", null).not("last_tread_mm", "is", null).range(a, b)),
    db.from("fleet_settings").select("tread_warn_mm").eq("id", 1).maybeSingle().then((r: any) => r.data),
    listFleetIntervalDefaults().catch(() => []),
  ]);
  const warnMm = Number(settings?.tread_warn_mm ?? 3);

  const by = <T extends { vehicle_id: string }>(arr: T[], id: string) => arr.filter((x) => x.vehicle_id === id);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });

  const rows = vehicles.map((v) => {
    const odo = effectiveOdometer((v as any).odometer_baseline_mi ?? 0, by(slips, v.id), by(readings, v.id));
    const due = computeNextDue(by(logs, v.id), by(intervals, v.id), { baselineMileage: odo.base, timeslipMileage: odo.sinceMiles, fleetDefaults });
    const current = policies.filter((p) => p.vehicle_id === v.id && p.start_date <= today).sort((a, b) => b.end_date.localeCompare(a.end_date))[0];
    return { vehicle: v, odometer: odo.total, due, openIssues: by(issues, v.id), insuranceEnd: current?.end_date ?? null,
      openRepairs: by(repairs, v.id), lowTyres: by(tyres, v.id).filter((t: any) => Number(t.last_tread_mm) <= warnMm) };
  });
  return { rows, recent, policies };
}

export async function loadVehicleAudit(vehicleId: string): Promise<FleetAuditRow[]> {
  const { data, error } = await db.from("fleet_audit_log").select("*").eq("vehicle_id", vehicleId).order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  return data ?? [];
}

export const AUDIT_TABLE_LABEL: Record<string, string> = {
  vehicles: "Vehicle",
  vehicle_issues: "Issue",
  vehicle_odometer_readings: "Mileage",
  vehicle_maintenance_logs: "Service",
  vehicle_maintenance_intervals: "Service schedule",
  fleet_inspections: "Inspection",
  fleet_inspection_results: "Inspection check",
  fleet_inspection_templates: "Checklist",
  fleet_inspection_template_items: "Checklist item",
  fleet_repair_jobs: "Repair job",
  fleet_repair_providers: "Garage",
  fleet_tyres: "Tyre",
};

export function describeAudit(r: FleetAuditRow): string {
  const what = AUDIT_TABLE_LABEL[r.table_name] ?? r.table_name;
  const c = r.changes ?? {};
  if (r.action === "status_changed") return `Status changed from ${c.status?.from ?? "—"} to ${c.status?.to ?? "—"}`;
  if (r.table_name === "vehicle_issues" && r.action === "insert") return `Issue raised: ${c.title ?? ""}`;
  if (r.table_name === "vehicle_issues" && c.status) return `Issue ${c.status.to === "resolved" ? "resolved" : "reopened"}`;
  if (r.table_name === "vehicle_odometer_readings" && r.action === "insert") return `Mileage recorded: ${Number(c.odometer_mi ?? 0).toLocaleString("en-GB")} mi`;
  if (r.action === "insert") return `${what} added`;
  if (r.action === "delete") return `${what} deleted`;
  return `${what} updated (${Object.keys(c).join(", ")})`;
}
