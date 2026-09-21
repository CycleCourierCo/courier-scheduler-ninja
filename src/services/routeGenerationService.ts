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
  is_provisional: boolean;
  stop_count: number;
  duration_s: number;
  miles: number;
  max_load: number;
  van_capacity: number;
  geometry: string | null;
  guaranteed_count: number;
  stops: PlanStop[];
}

export interface PlanDayShortfall {
  extra_vans: number;
  extra_jobs: number;
  urgent: number;
}

export interface PlanDay {
  date: string;
  vans_needed: number;
  vans_available: number;
  van_names: string[];
  spare_vans: number;
  is_provisional: boolean;
  shortfall: PlanDayShortfall | null;
  variants: { variant: string; routes: PlanRoute[]; tradeoff_note: string | null }[];
  /** Jobs that could have run on this day but were left out of every route. */
  unplanned_count?: number;
  infeasible_guaranteed: { order_id: string; label: string; leg_type: string; date: string }[];
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

export interface NeedsNewDatesLeg {
  order_id: string;
  label: string;
  leg_type: string;
  severity: number;
  reason: string;
  days_in_depot: number | null;
  last_date: string | null;
  guaranteed_date: string | null;
  status: "expired" | "awaiting_new_dates";
  linked_leg_note: string | null;
}

/** 'joint' balances the whole stretch of days; 'greedy' fills each day in turn. */
export type PlanMode = "joint" | "greedy";

export interface RoutePlanResult {
  plan_id: string | null;
  mode?: PlanMode;
  /** Jobs across the whole stretch of days that could not be fitted anywhere. */
  unplanned_count?: number;
  generated_at?: string;
  firm_days?: number;
  days: PlanDay[];
  at_risk: AtRiskLeg[];
  needs_new_dates: NeedsNewDatesLeg[];
  vans: { id: string; name: string; capacity: number }[];
  weekly: { van_days_available: number; van_days_needed: number; short_days: string[] } | null;
}

export interface GenerateRoutesInput {
  selected_dates: string[];
  shift_start: string;
  van_ids?: string[];
  /** Per-day van availability grid: { "2026-01-05": [vanId, ...] }. */
  van_availability?: Record<string, string[]>;
  firm_days?: number;
  /** Null means inspection deliveries are never auto-unlocked. */
  inspection_lead_days?: number | null;
  mode?: PlanMode;
}

export interface PlanComparison {
  stops: number;
  atRisk: number;
  vanDays: number;
  hours: number;
  miles: number;
}

/** Headline figures for one plan, so two ways of planning can be compared. */
export const summarisePlan = (plan: RoutePlanResult | null): PlanComparison => {
  const out: PlanComparison = { stops: 0, atRisk: 0, vanDays: 0, hours: 0, miles: 0 };
  if (!plan) return out;
  out.atRisk = plan.at_risk?.length ?? 0;
  for (const day of plan.days ?? []) {
    const routes = day.variants?.[0]?.routes ?? [];
    out.vanDays += routes.length;
    for (const route of routes) {
      out.stops += route.stops?.length ?? 0;
      out.hours += (Number(route.duration_s) || 0) / 3600;
      out.miles += Number(route.miles) || 0;
    }
  }
  return out;
};

export const generateRoutes = async (input: GenerateRoutesInput): Promise<RoutePlanResult> => {
  const { data, error } = await supabase.functions.invoke("route-optimize", { body: input });
  if (error) {
    const detail = (data as any)?.error || error.message;
    throw new Error(detail || "Route generation failed");
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as RoutePlanResult;
};

/** Check a fixed stop order actually fits the day. */
export const validateRoute = async (input: {
  date: string;
  shift_start: string;
  stops: { order_id: string; lat: number; lon: number; window?: [string, string] }[];
}) => {
  const { data, error } = await supabase.functions.invoke("route-validate", { body: input });
  if (error) throw new Error((data as any)?.error || error.message);
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as {
    date: string; duration_s: number; miles: number; finishes_at: string; over_13h: boolean;
    unassigned: number; window_violations: { seq: number; order_id: string | null }[];
    etas: { seq: number; order_id: string | null; eta: string }[];
  };
};

/** Re-check expired customer dates now instead of waiting for the nightly run. */
export const refreshAvailabilityExpiry = async () => {
  const { data, error } = await supabase.functions.invoke("expire-availability", { body: {} });
  if (error) throw new Error((data as any)?.error || error.message);
  return data as { expired: number; revived: number };
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

/** Working days configured for the business (short keys: sun, mon, …). */
export const fetchWorkingDays = async (): Promise<string[]> => {
  const { data, error } = await supabase
    .from("workshop_settings" as any)
    .select("working_days,default_horizon_days")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) return ["sun", "mon", "tue", "wed", "thu"];
  const days = (data as any).working_days;
  return Array.isArray(days) && days.length > 0 ? days : ["sun", "mon", "tue", "wed", "thu"];
};

/** Difficult-area outlines for faint map shading. */
export const fetchDifficultAreas = async () => {
  const { data, error } = await supabase.rpc("difficult_areas_geojson" as any);
  if (error) throw error;
  return (data as any[]) || [];
};

/** Lock a day's routes: its jobs are reserved and won't be re-planned. */
export const lockPlanDay = async (planId: string, date: string) => {
  const { error } = await supabase
    .from("route_plan_routes" as any)
    .update({ day_status: "locked", is_provisional: false, selected: true })
    .eq("plan_id", planId)
    .eq("route_date", date);
  if (error) throw error;
};

/** Release a locked day back to draft so it can be re-planned. */
export const unlockPlanDay = async (planId: string, date: string) => {
  const { error } = await supabase
    .from("route_plan_routes" as any)
    .update({ day_status: "draft", selected: false })
    .eq("plan_id", planId)
    .eq("route_date", date);
  if (error) throw error;
};

/** Mark a generated route as the one being used. */
export const selectPlanRoute = async (planId: string, routeId: string) => {
  const { error } = await supabase
    .from("route_plan_routes" as any)
    .update({ selected: true, day_status: "locked", is_provisional: false })
    .eq("id", routeId);
  if (error) throw error;
  await supabase.from("route_plans" as any).update({ status: "partially_selected" }).eq("id", planId);
};

/** Ask the customer for fresh dates on an expired leg. */
export const requestNewDates = async (orderId: string, legType: string) => {
  const { error } = await supabase
    .from("order_leg_availability" as any)
    .upsert({
      order_id: orderId,
      leg_type: legType,
      availability_status: "awaiting_new_dates",
      redate_requested_at: new Date().toISOString(),
    }, { onConflict: "order_id,leg_type" });
  if (error) throw error;
};

/** Put a leg back into planning (dates sorted, or asked in error). */
export const clearNewDatesRequest = async (orderId: string, legType: string) => {
  const { error } = await supabase
    .from("order_leg_availability" as any)
    .upsert({
      order_id: orderId,
      leg_type: legType,
      availability_status: "active",
      availability_expired_at: null,
      redate_requested_at: null,
    }, { onConflict: "order_id,leg_type" });
  if (error) throw error;
};

/** Mark a van as unavailable (or available again) on a day. */
export const setVanUnavailable = async (vanId: string, date: string, unavailable: boolean) => {
  if (unavailable) {
    const { error } = await supabase
      .from("van_unavailability" as any)
      .upsert({ van_id: vanId, unavailable_on: date }, { onConflict: "van_id,unavailable_on" });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("van_unavailability" as any)
      .delete()
      .eq("van_id", vanId)
      .eq("unavailable_on", date);
    if (error) throw error;
  }
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

const SHORT_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/** The next `count` working days, starting tomorrow. */
export const nextWorkingDays = (workingDays: string[], count: number): string[] => {
  const out: string[] = [];
  const cursor = new Date();
  cursor.setHours(12, 0, 0, 0);
  for (let i = 0; i < 60 && out.length < count; i++) {
    cursor.setDate(cursor.getDate() + 1);
    const key = SHORT_KEYS[(cursor.getDay() + 6) % 7];
    if (workingDays.includes(key)) {
      out.push(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(cursor));
    }
  }
  return out;
};

export const isWorkingDay = (date: string, workingDays: string[]) => {
  const d = new Date(`${date}T12:00:00Z`);
  return workingDays.includes(SHORT_KEYS[(d.getUTCDay() + 6) % 7]);
};
