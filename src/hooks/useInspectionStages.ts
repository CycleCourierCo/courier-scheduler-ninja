import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Loads the current inspection stage for a set of orders so packing surfaces
 * (Box My Bike / Foam My Bike) can gate on service completion.
 *
 * Returns a map of order_id -> most advanced inspection status.
 */
const STAGE_RANK: Record<string, number> = {
  pending: 0,
  inspected: 1,
  awaiting_pricing: 2,
  issues_found: 3,
  awaiting_parts: 4,
  awaiting_repair: 5,
  in_repair: 6,
  cleaning: 7,
  repaired: 8,
};

export const fetchInspectionStages = async (
  orderIds: string[]
): Promise<Record<string, string>> => {
  if (orderIds.length === 0) return {};
  const { data, error } = await supabase
    .from("bicycle_inspections")
    .select("order_id, status")
    .in("order_id", orderIds);
  if (error) throw error;

  const map: Record<string, string> = {};
  for (const row of data || []) {
    const id = (row as any).order_id as string;
    const status = (row as any).status as string;
    if (!map[id] || (STAGE_RANK[status] ?? -1) > (STAGE_RANK[map[id]] ?? -1)) {
      map[id] = status;
    }
  }
  return map;
};

export const useInspectionStages = (orderIds: string[]) => {
  const key = [...orderIds].sort().join(",");
  return useQuery({
    queryKey: ["inspection-stages", key],
    queryFn: () => fetchInspectionStages(orderIds),
    enabled: orderIds.length > 0,
  });
};
