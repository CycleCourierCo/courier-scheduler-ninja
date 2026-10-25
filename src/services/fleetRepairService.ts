import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;
const must = <T,>({ data, error }: { data: T; error: any }) => { if (error) throw new Error(error.message); return data; };

export interface RepairProvider { id: string; name: string; phone: string | null; email: string | null; address: string | null; notes: string | null; active: boolean }
export interface RepairJob {
  id: string; vehicle_id: string; defect_id: string | null; interval_id: string | null; provider_id: string | null;
  title: string; description: string | null; status: string; booked_for: string | null; odometer_mi: number | null;
  quoted_cost: number | null; labour_cost: number | null; parts_cost: number | null; vat: number | null; final_cost: number | null;
  invoice_ref: string | null; invoice_path: string | null; verified_by_name: string | null; verified_at: string | null;
  completed_at: string | null; created_at: string;
}
export interface Tyre {
  id: string; vehicle_id: string; position: string; brand: string | null; model: string | null; size: string | null;
  fitted_date: string | null; fitted_odometer_mi: number | null; last_tread_mm: number | null; last_inspected_at: string | null;
  cost: number | null; supplier: string | null; removed_date: string | null; removal_reason: string | null; notes: string | null;
}
export interface FleetSettings { inspection_frequency_days: number; tread_warn_mm: number; reminder_days: number[]; mileage_margin_mi: number }

export const DEFAULT_FLEET_SETTINGS: FleetSettings = { inspection_frequency_days: 7, tread_warn_mm: 3, reminder_days: [30, 7, 0], mileage_margin_mi: 500 };

export const getFleetSettings = async (): Promise<FleetSettings> => {
  const { data } = await db.from("fleet_settings").select("*").eq("id", 1).maybeSingle();
  return data ?? DEFAULT_FLEET_SETTINGS;
};
export const saveFleetSettings = async (s: Partial<FleetSettings>) => must(await db.from("fleet_settings").update({ ...s, updated_at: new Date().toISOString() }).eq("id", 1));

export const listProviders = async (): Promise<RepairProvider[]> => must(await db.from("fleet_repair_providers").select("*").order("name"));
export const saveProvider = async (p: Partial<RepairProvider>) =>
  p.id ? must(await db.from("fleet_repair_providers").update(p).eq("id", p.id)) : must(await db.from("fleet_repair_providers").insert(p));

export const listRepairs = async (vehicleId?: string): Promise<RepairJob[]> => {
  let q = db.from("fleet_repair_jobs").select("*").order("created_at", { ascending: false });
  if (vehicleId) q = q.eq("vehicle_id", vehicleId);
  return must(await q);
};
export const saveRepair = async (r: Partial<RepairJob>) =>
  r.id ? must(await db.from("fleet_repair_jobs").update(r).eq("id", r.id)) : must(await db.from("fleet_repair_jobs").insert(r));

export const listTyres = async (vehicleId?: string): Promise<Tyre[]> => {
  let q = db.from("fleet_tyres").select("*").order("fitted_date", { ascending: false, nullsFirst: false });
  if (vehicleId) q = q.eq("vehicle_id", vehicleId);
  return must(await q);
};
export const saveTyre = async (t: Partial<Tyre>) =>
  t.id ? must(await db.from("fleet_tyres").update(t).eq("id", t.id)) : must(await db.from("fleet_tyres").insert(t));

/** Replacing keeps the old tyre as history (removed) and fits a new one in the same position. */
export async function replaceTyre(old: Tyre, next: Partial<Tyre>, reason: string) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  must(await db.from("fleet_tyres").update({ removed_date: next.fitted_date ?? today, removal_reason: reason || "Replaced" }).eq("id", old.id));
  must(await db.from("fleet_tyres").insert({ ...next, vehicle_id: old.vehicle_id, position: old.position }));
}
