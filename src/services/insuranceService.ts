import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { Vehicle } from "./vehicleService";

export type InsurancePolicy = Database["public"]["Tables"]["vehicle_insurance_policies"]["Row"];
export type InsurancePolicyInsert = Database["public"]["Tables"]["vehicle_insurance_policies"]["Insert"];
export type InsurancePolicyUpdate = Database["public"]["Tables"]["vehicle_insurance_policies"]["Update"];

export async function listPolicies(): Promise<InsurancePolicy[]> {
  const { data, error } = await supabase
    .from("vehicle_insurance_policies")
    .select("*")
    .order("start_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createPolicy(input: InsurancePolicyInsert): Promise<InsurancePolicy> {
  const { data, error } = await supabase
    .from("vehicle_insurance_policies")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updatePolicy(id: string, patch: InsurancePolicyUpdate): Promise<InsurancePolicy> {
  const { data, error } = await supabase
    .from("vehicle_insurance_policies")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deletePolicy(id: string): Promise<void> {
  const { error } = await supabase.from("vehicle_insurance_policies").delete().eq("id", id);
  if (error) throw error;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

export function isVehicleInsured(vehicleId: string, policies: InsurancePolicy[], on: string = todayStr()) {
  return policies.some(
    (p) => p.vehicle_id === vehicleId && p.start_date <= on && p.end_date >= on
  );
}

export function getUninsuredVehicles(vehicles: Vehicle[], policies: InsurancePolicy[]): Vehicle[] {
  return vehicles
    .filter((v) => v.status !== "sold" && v.status !== "written_off")
    .filter((v) => !isVehicleInsured(v.id, policies));
}
