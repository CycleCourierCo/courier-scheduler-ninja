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
  /** Planned on a later plan day because its own dates were full. */
  planned_after_expiry?: boolean;
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
  /** Part of the country this route covers, e.g. "North East". */
  region?: string;
  /** Widest gap between any two stops on the route, in miles. */
  spread_mi?: number;
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
  /** Left-over jobs whose stored dates had all lapsed (only when the override is on). */
  unplanned_lapsed_count?: number;
  /** Planned stops whose customer dates had lapsed before this run. */
  lapsed_count?: number;
  /** Jobs whose last available date is this day (at risk of lapsing). */
  expiring_count?: number;
  /** Of those, jobs not placed on any route. */
  expiring_unplanned_count?: number;
  infeasible_guaranteed: { order_id: string; label: string; leg_type: string; date: string }[];
}

export interface AtRiskLeg {
  order_id: string;
  label: string;
  leg_type: string;
  priority: number;
  remaining_dates: number;
  /** Last available customer date, when known. */
  last_date?: string | null;
  guaranteed_date: string | null;
  reason: string;
}

/** Why a leg cannot be planned: dates never given, lapsed, or a missed guarantee. */
export type DateState = "never_provided" | "expired" | "guaranteed_missed";

export interface NeedsNewDatesLeg {
  order_id: string;
  label: string;
  leg_type: string;
  severity: number;
  date_state?: DateState;
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
  /** Left-over jobs whose dates had all lapsed (override runs only). */
  unplanned_lapsed_count?: number;
  /** Jobs whose last remaining date falls inside this plan window. */
  expiring_in_plan_count?: number;
  /** Of those, jobs not placed on any route. */
  expiring_unplanned_count?: number;
  generated_at?: string;
  firm_days?: number;
  /** The "an extra van would plan N more jobs" figures are still loading. */
  shortfall_pending?: boolean;
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
  /** Plan legs whose customer dates have all lapsed anyway (per-run override). */
  include_expired?: boolean;
  /** How many 15h long "expedition" days may be used on any one day (0–4). */
  max_long_days?: number;
  mode?: PlanMode;
}

export interface PlanComparison {
  stops: number;
  jobs: number;
  atRisk: number;
  /** Jobs left out of every route across the whole stretch of days. */
  leftOver: number;
  vanDays: number;
  hours: number;
  miles: number;
}

/** Headline figures for one plan, so two ways of planning can be compared. */
export const summarisePlan = (plan: RoutePlanResult | null): PlanComparison => {
  const out: PlanComparison = { stops: 0, jobs: 0, atRisk: 0, leftOver: 0, vanDays: 0, hours: 0, miles: 0 };
  if (!plan) return out;
  out.atRisk = plan.at_risk?.length ?? 0;
  out.leftOver = plan.unplanned_count ?? out.atRisk;
  const orders = new Set<string>();
  for (const day of plan.days ?? []) {
    const routes = day.variants?.[0]?.routes ?? [];
    out.vanDays += routes.length;
    for (const route of routes) {
      out.stops += route.stops?.length ?? 0;
      out.hours += (Number(route.duration_s) || 0) / 3600;
      out.miles += Number(route.miles) || 0;
      route.stops?.forEach((s) => orders.add(s.order_id));
    }
  }
  out.jobs = orders.size;
  return out;
};

/** Every route in a plan, flattened, for whole-plan totals and costings. */
export const allPlanRoutes = (plan: RoutePlanResult | null): PlanRoute[] =>
  (plan?.days ?? []).flatMap((d) => d.variants?.[0]?.routes ?? []);

/** Turn platform-level failures into something a dispatcher can act on. */
const planningError = (raw: string | undefined) => {
  const msg = raw || "Route generation failed";
  if (/non-2xx|CPU|timed out|timeout|Failed to send|FunctionsFetchError|load failed/i.test(msg)) {
    return "That many days and vans was too much to plan in one go — try fewer days or fewer vans.";
  }
  return msg;
};

export const generateRoutes = async (input: GenerateRoutesInput): Promise<RoutePlanResult> => {
  const { data, error } = await supabase.functions.invoke("route-optimize", { body: input });
  if (error) throw new Error(planningError((data as any)?.error || error.message));
  if ((data as any)?.error) throw new Error(planningError((data as any).error));
  return data as RoutePlanResult;
};

/** Second, lighter call: the per-day "an extra van would fit N more jobs" figures. */
export const fetchPlanShortfall = async (
  input: GenerateRoutesInput,
): Promise<Record<string, PlanDayShortfall | null>> => {
  const { data, error } = await supabase.functions.invoke("route-optimize", {
    body: { ...input, shortfall_only: true },
  });
  if (error || (data as any)?.error) return {};
  return ((data as any)?.shortfall_by_date ?? {}) as Record<string, PlanDayShortfall | null>;
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
  // Only vans that are actually part of the working fleet: in use or off road.
  // Anything in repair, awaiting sale, sold or written off is never plannable.
  return (data || [])
    .filter((v: any) => v.status === "in_use" || v.status === "off_road")
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

/** Legs currently marked expired or waiting on new dates — shown before any run. */
export const fetchLapsedLegs = async (): Promise<NeedsNewDatesLeg[]> => {
  const { data, error } = await supabase
    .from("order_leg_availability")
    .select("order_id,leg_type,availability_status,orders!inner(tracking_number)");
  if (error) throw error;
  return ((data as any[]) || [])
    .filter((r) => r.availability_status === "expired" || r.availability_status === "awaiting_new_dates")
    .map((r) => ({
      order_id: r.order_id as string,
      label: (r.orders?.tracking_number || r.order_id.slice(0, 8)) as string,
      leg_type: r.leg_type as string,
      severity: 3,
      date_state: "expired" as const,
      reason: r.availability_status === "awaiting_new_dates"
        ? "Waiting on new dates from the customer"
        : "Dates expired",
      days_in_depot: null,
      last_date: null,
      guaranteed_date: null,
      status: r.availability_status as "expired" | "awaiting_new_dates",
      linked_leg_note: null,
    }));
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
