import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type VehicleStatus = Database["public"]["Enums"]["vehicle_status"];
export type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];
export type VehicleInsert = Database["public"]["Tables"]["vehicles"]["Insert"];
export type VehicleUpdate = Database["public"]["Tables"]["vehicles"]["Update"];

export interface VesLookupResult {
  registration: string;
  make: string | null;
  colour: string | null;
  fuel_type: string | null;
  year_of_manufacture: number | null;
  engine_capacity: number | null;
  co2_emissions: number | null;
  tax_status: string | null;
  tax_due_date: string | null;
  mot_status: string | null;
  mot_expiry_date: string | null;
  date_of_last_v5c_issued: string | null;
  marked_for_export: boolean | null;
  type_approval: string | null;
  wheelplan: string | null;
  revenue_weight: number | null;
  euro_status: string | null;
  real_driving_emissions: string | null;
  ves_raw: Record<string, unknown>;
}

export const VEHICLE_STATUS_OPTIONS: { value: VehicleStatus; label: string }[] = [
  { value: "purchased", label: "Purchased" },
  { value: "in_prep", label: "In Prep" },
  { value: "in_use", label: "In Use" },
  { value: "in_service", label: "In Service" },
  { value: "in_repair", label: "In Repair" },
  { value: "mot_due", label: "MOT Due" },
  { value: "reserved", label: "Reserved" },
  { value: "off_road", label: "Off Road" },
  { value: "awaiting_sale", label: "Awaiting Sale" },
  { value: "sold", label: "Sold" },
  { value: "written_off", label: "Written Off" },
];

export const normaliseReg = (s: string) =>
  (s || "").toUpperCase().replace(/\s+/g, "").trim();

export async function lookupVehicleFromDVLA(registration: string): Promise<VesLookupResult> {
  const { data, error } = await supabase.functions.invoke("lookup-vehicle", {
    body: { registration: normaliseReg(registration) },
  });
  if (error) {
    // Edge function errors come through with a useful message
    const msg = (data as { error?: string } | null)?.error ?? error.message;
    throw new Error(msg || "DVLA lookup failed");
  }
  if ((data as { error?: string })?.error) {
    throw new Error((data as { error: string }).error);
  }
  return data as VesLookupResult;
}

export async function listVehicles(): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createVehicle(input: VehicleInsert): Promise<Vehicle> {
  const { data, error } = await supabase
    .from("vehicles")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateVehicle(id: string, patch: VehicleUpdate): Promise<Vehicle> {
  const { data, error } = await supabase
    .from("vehicles")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteVehicle(id: string): Promise<void> {
  const { error } = await supabase.from("vehicles").delete().eq("id", id);
  if (error) throw error;
}

// Sum approved-timeslip mileage grouped by vehicle_id (paginated to bypass 1000-row limit).
export async function getVehicleMileageTotals(): Promise<Record<string, number>> {
  const totals: Record<string, number> = {};
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("timeslips")
      .select("vehicle_id,mileage")
      .eq("status", "approved")
      .not("vehicle_id", "is", null)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data as { vehicle_id: string | null; mileage: number | null }[]) {
      if (!r.vehicle_id) continue;
      totals[r.vehicle_id] = (totals[r.vehicle_id] || 0) + (Number(r.mileage) || 0);
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return totals;
}
