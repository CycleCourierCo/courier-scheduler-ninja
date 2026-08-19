import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BikeSpaceMap = Record<string, number>;

export const DEFAULT_VAN_SPACES_CAPACITY = 10;

/** Normalise a bike type string for lenient matching. */
const norm = (s: string) => s.trim().toLowerCase();

/**
 * Resolve how many van spaces a bike type takes up.
 * Falls back to partial (substring) matching, then 1 space.
 */
export function getSpacesForBikeType(
  bikeType: string | null | undefined,
  spaceMap: BikeSpaceMap,
): number {
  if (!bikeType) return 1;
  const exact = spaceMap[bikeType];
  if (typeof exact === "number") return exact;

  const lower = norm(bikeType);
  for (const [key, value] of Object.entries(spaceMap)) {
    if (norm(key) === lower) return value;
  }
  for (const [key, value] of Object.entries(spaceMap)) {
    const k = norm(key);
    if (lower.includes(k) || k.includes(lower)) return value;
  }
  return 1;
}

interface SpaceOrderLike {
  bike_type?: string | null;
  bike_quantity?: number | null;
  bikes?: unknown;
}

/**
 * Total van spaces an order takes up, summing per-bike from the `bikes`
 * snapshot when available, otherwise bike_type × quantity.
 */
export function getOrderSpaces(
  order: SpaceOrderLike | null | undefined,
  spaceMap: BikeSpaceMap,
): number {
  if (!order) return 1;

  const bikes = Array.isArray(order.bikes) ? (order.bikes as any[]) : null;
  if (bikes && bikes.length > 0) {
    const total = bikes.reduce((sum, bike) => {
      const type = bike?.type ?? bike?.bikeType ?? bike?.bike_type ?? null;
      const qty = Number(bike?.quantity ?? 1) || 1;
      return sum + getSpacesForBikeType(type, spaceMap) * qty;
    }, 0);
    if (total > 0) return Math.round(total * 100) / 100;
  }

  const quantity = order.bike_quantity && order.bike_quantity > 0 ? order.bike_quantity : 1;
  const per = getSpacesForBikeType(order.bike_type ?? null, spaceMap);
  return Math.round(per * quantity * 100) / 100;
}

export function formatSpaces(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export interface BikeTypeSpaceRow {
  bike_type: string;
  spaces: number;
}

export function useBikeSpaces() {
  return useQuery({
    queryKey: ["bike_type_spaces"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<{ spaceMap: BikeSpaceMap; rows: BikeTypeSpaceRow[]; capacity: number }> => {
      const [spacesRes, settingsRes] = await Promise.all([
        supabase.from("bike_type_spaces" as any).select("bike_type,spaces").order("bike_type"),
        supabase.from("workshop_settings").select("*").eq("id", 1).maybeSingle(),
      ]);

      if (spacesRes.error) throw spacesRes.error;

      const rows: BikeTypeSpaceRow[] = ((spacesRes.data as any[]) || []).map((r) => ({
        bike_type: r.bike_type,
        spaces: Number(r.spaces),
      }));
      const spaceMap: BikeSpaceMap = {};
      rows.forEach((r) => {
        spaceMap[r.bike_type] = r.spaces;
      });

      const capacityRaw = (settingsRes.data as any)?.van_spaces_capacity;
      const capacity = Number(capacityRaw) > 0 ? Number(capacityRaw) : DEFAULT_VAN_SPACES_CAPACITY;

      return { spaceMap, rows, capacity };
    },
  });
}

export function useUpdateBikeSpaces() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ rows, capacity }: { rows: BikeTypeSpaceRow[]; capacity: number }) => {
      if (rows.length > 0) {
        const { error } = await supabase
          .from("bike_type_spaces" as any)
          .upsert(
            rows.map((r) => ({
              bike_type: r.bike_type,
              spaces: r.spaces,
              updated_at: new Date().toISOString(),
            })),
            { onConflict: "bike_type" },
          );
        if (error) throw error;
      }

      const { error: settingsError } = await supabase
        .from("workshop_settings")
        .update({ van_spaces_capacity: capacity, updated_at: new Date().toISOString() } as any)
        .eq("id", 1);
      if (settingsError) throw settingsError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bike_type_spaces"] });
      qc.invalidateQueries({ queryKey: ["workshop_settings"] });
    },
  });
}
