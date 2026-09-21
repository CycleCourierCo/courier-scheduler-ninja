import { supabase } from "@/integrations/supabase/client";

export interface PlanStop {
  seq: number;
  leg_type: "collection" | "delivery";
  order_id: string;
  eta: string;
  lat: number;
  lon: number;
  is_difficult_area: boolean;
  label: string;
  guaranteed: boolean;
}

export interface PlanRoute {
  route_id: string;
  van_id: string;
  van_name: string;
  is_expedition: boolean;
  stop_count: number;
  duration_s: number;
  miles: number;
  max_load: number;
  van_capacity: number;
  geometry: string | null;
  guaranteed_count: number;
  stops: PlanStop[];
}

export interface PlanDay {
  date: string;
  vans_needed: number;
  vans_available: number;
  van_names: string[];
  variants: { variant: string; routes: PlanRoute[]; tradeoff_note: string | null }[];
  infeasible_guaranteed: { order_id: string; label: string; leg_type: string; date: string }[];
  unassigned_today?: number;
}

export interface AtRiskLeg {
  order_id: string;
  label: string;
  leg_type: string;
  priority: number;
  remaining_dates: number;
  guaranteed_date: string | null;
  reason: string;
}

export interface RoutePlanResult {
  plan_id: string;
  days: PlanDay[];
  at_risk: AtRiskLeg[];
  vans: { id: string; name: string; capacity: number }[];
}

export interface GenerateRoutesInput {
  horizon_start: string;
  horizon_end: string;
  shift_start: string;
  van_ids: string[];
  assume_next_day_inspection?: boolean;
}

export const generateRoutes = async (input: GenerateRoutesInput): Promise<RoutePlanResult> => {
  const { data, error } = await supabase.functions.invoke("route-optimize", { body: input });
  if (error) {
    const detail = (data as any)?.error || error.message;
    throw new Error(detail || "Route generation failed");
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as RoutePlanResult;
};

/** Vans that can be used for planning. */
export const fetchPlanningVans = async () => {
  const { data, error } = await supabase
    .from("vehicles")
    .select("id,registration,make,bike_spaces,status")
    .order("registration");
  if (error) throw error;
  return (data || [])
    .filter((v: any) => v.status !== "sold" && v.status !== "off_road")
    .map((v: any) => ({
      id: v.id as string,
      name: (v.registration || v.make || "Van") as string,
      capacity: Number(v.bike_spaces) > 0 ? Number(v.bike_spaces) : null,
    }));
};

/** Difficult-area outlines for faint map shading. */
export const fetchDifficultAreas = async () => {
  const { data, error } = await supabase.rpc("difficult_areas_geojson" as any);
  if (error) throw error;
  return (data as any[]) || [];
};

/** Mark a generated route as the one being used. */
export const selectPlanRoute = async (planId: string, routeId: string) => {
  const { error } = await supabase
    .from("route_plan_routes" as any)
    .update({ selected: true })
    .eq("id", routeId);
  if (error) throw error;
  await supabase.from("route_plans" as any).update({ status: "partially_selected" }).eq("id", planId);
};

/** Decode a Google-encoded polyline into [lat, lon] pairs. */
export const decodePolyline = (encoded: string): [number, number][] => {
  const points: [number, number][] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let result = 0, shift = 0, b: number;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    result = 0; shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
};

export const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
};
