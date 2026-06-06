import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_INTERVALS,
  type ServicePosition,
  type ServiceType,
} from "@/constants/vehicleMaintenance";

export interface MaintenanceLog {
  id: string;
  vehicle_id: string;
  service_type: ServiceType;
  custom_name: string | null;
  position: ServicePosition | null;
  service_date: string;
  odometer_mi: number | null;
  cost: number | null;
  vendor: string | null;
  notes: string | null;
  brand: string | null;
  model: string | null;
  part_number: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceInterval {
  id: string;
  vehicle_id: string;
  service_type: ServiceType;
  position: ServicePosition | null;
  custom_name: string | null;
  interval_miles: number | null;
  interval_months: number | null;
}

export type MaintenanceLogInput = Omit<
  MaintenanceLog,
  "id" | "created_at" | "updated_at" | "created_by"
>;

export async function listLogs(vehicleId: string): Promise<MaintenanceLog[]> {
  const { data, error } = await supabase
    .from("vehicle_maintenance_logs" as never)
    .select("*")
    .eq("vehicle_id", vehicleId)
    .order("service_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as MaintenanceLog[];
}

export async function createLog(input: MaintenanceLogInput): Promise<MaintenanceLog> {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("vehicle_maintenance_logs" as never)
    .insert({ ...input, created_by: auth.user?.id ?? null } as never)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as MaintenanceLog;
}

export async function updateLog(
  id: string,
  patch: Partial<MaintenanceLogInput>,
): Promise<MaintenanceLog> {
  const { data, error } = await supabase
    .from("vehicle_maintenance_logs" as never)
    .update(patch as never)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as MaintenanceLog;
}

export async function deleteLog(id: string): Promise<void> {
  const { error } = await supabase
    .from("vehicle_maintenance_logs" as never)
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function listIntervals(vehicleId: string): Promise<MaintenanceInterval[]> {
  const { data, error } = await supabase
    .from("vehicle_maintenance_intervals" as never)
    .select("*")
    .eq("vehicle_id", vehicleId);
  if (error) throw error;
  return (data ?? []) as unknown as MaintenanceInterval[];
}

export async function upsertInterval(input: {
  vehicle_id: string;
  service_type: ServiceType;
  position: ServicePosition | null;
  custom_name: string | null;
  interval_miles: number | null;
  interval_months: number | null;
}): Promise<void> {
  // Manual upsert (composite unique can't be created on enum cols cleanly)
  const existing = await listIntervals(input.vehicle_id);
  const match = existing.find(
    (e) =>
      e.service_type === input.service_type &&
      (e.position ?? null) === (input.position ?? null) &&
      (e.custom_name ?? null) === (input.custom_name ?? null),
  );
  if (match) {
    const { error } = await supabase
      .from("vehicle_maintenance_intervals" as never)
      .update({
        interval_miles: input.interval_miles,
        interval_months: input.interval_months,
      } as never)
      .eq("id", match.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("vehicle_maintenance_intervals" as never)
      .insert(input as never);
    if (error) throw error;
  }
}

// Sum approved-timeslip mileage for one vehicle (paginated).
export async function getVehicleMileage(vehicleId: string): Promise<number> {
  let total = 0;
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("timeslips")
      .select("mileage")
      .eq("status", "approved")
      .eq("vehicle_id", vehicleId)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data as { mileage: number | null }[]) {
      total += Number(r.mileage) || 0;
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return total;
}

export interface DueItem {
  serviceType: ServiceType;
  position: ServicePosition | null;
  customName: string | null;
  label: string;
  lastDate: string | null;
  lastMiles: number | null;
  intervalMiles: number | null;
  intervalMonths: number | null;
  dueDate: string | null;
  dueMiles: number | null;
  remainingDays: number | null;
  remainingMiles: number | null;
  status: "ok" | "amber" | "red" | "unknown";
  neverDone: boolean;
}

const addMonthsISO = (iso: string, months: number): string => {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
};

export interface ComputeDueOptions {
  baselineMileage: number; // vehicle.odometer_baseline_mi
  timeslipMileage: number; // sum of approved timeslip mileage for vehicle
  today?: Date;
}

/** Effective odometer reading right now */
export function currentOdometer({ baselineMileage, timeslipMileage }: ComputeDueOptions): number {
  return (baselineMileage || 0) + (timeslipMileage || 0);
}

export function computeNextDue(
  logs: MaintenanceLog[],
  intervals: MaintenanceInterval[],
  opts: ComputeDueOptions,
): DueItem[] {
  const today = opts.today ?? new Date();
  const todayISO = today.toISOString().slice(0, 10);
  const currentMi = currentOdometer(opts);

  const buckets = new Map<string, IntervalDefault & { customName: string | null }>();
  const keyOf = (
    s: ServiceType,
    p: ServicePosition | null | undefined,
    c: string | null | undefined,
  ) => `${s}|${p ?? ""}|${c ?? ""}`;

  // Seed with defaults
  for (const d of DEFAULT_INTERVALS) {
    buckets.set(keyOf(d.serviceType, d.position ?? null, null), {
      ...d,
      customName: null,
    });
  }
  // Add "other" buckets derived from logs (so we know what to track)
  for (const log of logs) {
    if (log.service_type === "other" && log.custom_name) {
      buckets.set(keyOf("other", null, log.custom_name), {
        serviceType: "other",
        position: undefined,
        miles: null,
        months: 12,
        customName: log.custom_name,
      });
    }
  }
  // Override with per-vehicle intervals
  for (const iv of intervals) {
    buckets.set(keyOf(iv.service_type, iv.position, iv.custom_name), {
      serviceType: iv.service_type,
      position: iv.position ?? undefined,
      miles: iv.interval_miles,
      months: iv.interval_months,
      customName: iv.custom_name,
    });
  }

  // Index latest log per bucket
  const latest = new Map<string, MaintenanceLog>();
  for (const log of logs) {
    const k = keyOf(log.service_type, log.position, log.custom_name);
    const existing = latest.get(k);
    if (!existing || log.service_date > existing.service_date) latest.set(k, log);
  }

  const items: DueItem[] = [];
  for (const [k, b] of buckets) {
    const last = latest.get(k) ?? null;
    const lastDate = last?.service_date ?? null;
    const lastMiles = last?.odometer_mi ?? null;
    const intervalMiles = b.miles;
    const intervalMonths = b.months;

    const dueDate =
      lastDate && intervalMonths != null ? addMonthsISO(lastDate, intervalMonths) : null;
    const dueMiles =
      lastMiles != null && intervalMiles != null ? lastMiles + intervalMiles : null;

    const remainingDays = dueDate
      ? Math.round(
          (new Date(dueDate).getTime() - new Date(todayISO).getTime()) / (1000 * 60 * 60 * 24),
        )
      : null;
    const remainingMiles = dueMiles != null ? dueMiles - currentMi : null;

    // Status
    let status: DueItem["status"] = "unknown";
    if (!last) {
      status = "amber";
    } else {
      const milesPct =
        remainingMiles != null && intervalMiles
          ? 1 - remainingMiles / intervalMiles
          : null;
      const daysPct =
        remainingDays != null && intervalMonths
          ? 1 - remainingDays / (intervalMonths * 30)
          : null;
      const worst = Math.max(milesPct ?? 0, daysPct ?? 0);
      if (worst >= 1) status = "red";
      else if (worst >= 0.9) status = "amber";
      else status = "ok";
    }

    const label =
      b.serviceType === "other"
        ? b.customName || "Other"
        : `${
            {
              oil_filter: "Oil & filter",
              tyre: "Tyre",
              brake_pads: "Brake pads",
              brake_discs: "Brake discs",
              other: "Other",
            }[b.serviceType]
          }${
            b.position
              ? ` — ${
                  {
                    front_left: "Front-Left",
                    front_right: "Front-Right",
                    rear_left: "Rear-Left",
                    rear_right: "Rear-Right",
                    spare: "Spare",
                    front_axle: "Front axle",
                    rear_axle: "Rear axle",
                  }[b.position]
                }`
              : ""
          }`;

    items.push({
      serviceType: b.serviceType,
      position: b.position ?? null,
      customName: b.customName,
      label,
      lastDate,
      lastMiles,
      intervalMiles,
      intervalMonths,
      dueDate,
      dueMiles,
      remainingDays,
      remainingMiles,
      status,
      neverDone: !last,
    });
  }

  // Sort: red, amber, ok, unknown — then by remainingMiles/days ascending
  const order: Record<DueItem["status"], number> = { red: 0, amber: 1, ok: 2, unknown: 3 };
  items.sort((a, b) => order[a.status] - order[b.status]);
  return items;
}

interface IntervalDefault {
  serviceType: ServiceType;
  position?: ServicePosition;
  miles: number | null;
  months: number | null;
}
