import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type LabourTimeRow = Database["public"]["Tables"]["labour_times"]["Row"];
export type LabourTimeInsert = Database["public"]["Tables"]["labour_times"]["Insert"];
export type LabourTimeUpdate = Database["public"]["Tables"]["labour_times"]["Update"];
export type MultiplierRow = Database["public"]["Tables"]["labour_time_multipliers"]["Row"];

export interface ListLabourTimesParams {
  page: number;
  pageSize: number;
  bikeType?: string;
  category?: string;
  skillLevel?: string;
  search?: string;
}

export interface ListLabourTimesResult {
  rows: LabourTimeRow[];
  total: number;
}

export async function listLabourTimes(params: ListLabourTimesParams): Promise<ListLabourTimesResult> {
  const { page, pageSize, bikeType, category, skillLevel, search } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("labour_times")
    .select("*", { count: "exact" })
    .order("repair_id", { ascending: true })
    .range(from, to);

  if (bikeType && bikeType !== "__all__") query = query.eq("bike_type", bikeType);
  if (category && category !== "__all__") query = query.eq("category", category);
  if (skillLevel && skillLevel !== "__all__") query = query.eq("skill_level", skillLevel);
  if (search && search.trim().length >= 2) {
    const q = search.trim().replace(/[%,]/g, "");
    query = query.or(`repair_name.ilike.%${q}%,subcategory.ilike.%${q}%`);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: (data ?? []) as LabourTimeRow[], total: count ?? 0 };
}

async function fetchDistinctColumn(column: "bike_type" | "category" | "skill_level"): Promise<string[]> {
  // Paginate to avoid the 1000-row cap when deduplicating.
  const values = new Set<string>();
  let from = 0;
  const chunk = 1000;
  // Cap at 10 pages (10k rows) — plenty for 3.5k row table.
  for (let i = 0; i < 10; i++) {
    const { data, error } = await supabase
      .from("labour_times")
      .select(column)
      .order(column, { ascending: true })
      .range(from, from + chunk - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const row of data as Array<Record<string, string>>) {
      const v = row[column];
      if (v) values.add(v);
    }
    if (data.length < chunk) break;
    from += chunk;
  }
  return Array.from(values).sort();
}

export async function listFilterOptions() {
  const [bikeTypes, categories, skillLevels] = await Promise.all([
    fetchDistinctColumn("bike_type"),
    fetchDistinctColumn("category"),
    fetchDistinctColumn("skill_level"),
  ]);
  return { bikeTypes, categories, skillLevels };
}

export async function upsertLabourTime(row: LabourTimeInsert): Promise<void> {
  const { error } = await supabase.from("labour_times").upsert(row, { onConflict: "repair_id" });
  if (error) throw error;
}

export async function updateLabourTime(repairId: string, patch: LabourTimeUpdate): Promise<void> {
  const { error } = await supabase.from("labour_times").update(patch).eq("repair_id", repairId);
  if (error) throw error;
}

export async function deleteLabourTime(repairId: string): Promise<void> {
  const { error } = await supabase.from("labour_times").delete().eq("repair_id", repairId);
  if (error) throw error;
}

export async function nextCustomRepairId(): Promise<string> {
  const { data, error } = await supabase.rpc("next_custom_repair_id");
  if (error) throw error;
  return data as string;
}

// Multipliers
export async function listMultipliers(): Promise<MultiplierRow[]> {
  const { data, error } = await supabase
    .from("labour_time_multipliers")
    .select("*")
    .order("modifier", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MultiplierRow[];
}

export async function upsertMultiplier(row: MultiplierRow): Promise<void> {
  const { error } = await supabase.from("labour_time_multipliers").upsert(row, { onConflict: "modifier" });
  if (error) throw error;
}

export async function updateMultiplier(modifier: string, patch: Partial<MultiplierRow>): Promise<void> {
  const { error } = await supabase.from("labour_time_multipliers").update(patch).eq("modifier", modifier);
  if (error) throw error;
}

export async function deleteMultiplier(modifier: string): Promise<void> {
  const { error } = await supabase.from("labour_time_multipliers").delete().eq("modifier", modifier);
  if (error) throw error;
}
