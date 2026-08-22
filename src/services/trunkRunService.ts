import { supabase } from "@/integrations/supabase/client";
import { getOrderSpaces, type BikeSpaceMap } from "@/lib/bikeSpaces";
import { getStorageLocationLabels } from "@/utils/storageLocation";
import { scotlandDirectionOf, type ScotlandDirection } from "@/utils/scotland";

export type TrunkRunStatus = "planned" | "loaded" | "departed" | "arrived" | "cancelled";
export type TrunkDirection = "northbound" | "southbound";
export type TrunkDriverMode = "depot_trunker" | "scotland_driver";

export interface TrunkRun {
  id: string;
  run_date: string;
  direction: TrunkDirection;
  origin_site_id: string | null;
  destination_site_id: string | null;
  driver_id: string | null;
  vehicle_id: string | null;
  driver_mode: TrunkDriverMode;
  capacity_spaces: number;
  status: TrunkRunStatus;
  notes: string | null;
  departed_at: string | null;
  arrived_at: string | null;
  created_at: string;
}

export interface TrunkRunItem {
  id: string;
  run_id: string;
  order_id: string | null;
  stock_id: string | null;
  spaces: number;
  origin_bay: string | null;
  origin_position: number | null;
  destination_bay: string | null;
  destination_position: number | null;
  status: string;
  notes: string | null;
  // joined
  order?: TrunkCandidate | null;
}

export interface TrunkCandidate {
  id: string;
  tracking_number: string | null;
  status: string;
  sender_name: string;
  receiver_name: string;
  destination: string;
  bike_summary: string;
  spaces: number;
  direction: ScotlandDirection;
  storage_labels: string[];
  waiting_since: string | null;
  waiting_days: number;
  scheduled_delivery: string | null;
}

const ACTIVE_RUN_STATUSES: TrunkRunStatus[] = ["planned", "loaded", "departed"];

const FINISHED_ORDER_STATUSES = [
  "delivered",
  "cancelled",
  "delivered_by_3p",
  "collected_by_3p",
  "delivered_to_ferry",
];

const daysBetween = (iso: string | null): number => {
  if (!iso) return 0;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 0;
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
};

const nameOf = (side: any): string => side?.name || "Unknown";

const describeBikes = (order: any): string => {
  const bikes = Array.isArray(order?.bikes) ? order.bikes : [];
  if (bikes.length > 0) {
    return bikes
      .map((b: any) => [b?.brand, b?.model, b?.type].filter(Boolean).join(" "))
      .filter(Boolean)
      .join(", ");
  }
  return [order?.bike_brand, order?.bike_model, order?.bike_type].filter(Boolean).join(" ") || "Bike";
};

const destinationOf = (order: any): string => {
  const a = order?.receiver?.address || {};
  return [a.city, a.zipCode].filter(Boolean).join(", ") || "—";
};

const toCandidate = (order: any, spaceMap: BikeSpaceMap): TrunkCandidate => {
  const waitingSince = order.updated_at || order.created_at || null;
  return {
    id: order.id,
    tracking_number: order.tracking_number ?? null,
    status: order.status,
    sender_name: nameOf(order.sender),
    receiver_name: nameOf(order.receiver),
    destination: destinationOf(order),
    bike_summary: describeBikes(order),
    spaces: getOrderSpaces(order, spaceMap),
    direction: scotlandDirectionOf(order),
    storage_labels: getStorageLocationLabels(order.storage_locations),
    waiting_since: waitingSince,
    waiting_days: daysBetween(waitingSince),
    scheduled_delivery: order.scheduled_delivery_date ?? null,
  };
};

export const listTrunkRuns = async (limit = 50): Promise<TrunkRun[]> => {
  const { data, error } = await (supabase.from("trunk_runs" as any) as any)
    .select("*")
    .order("run_date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as TrunkRun[]) || [];
};

export const listTrunkRunItems = async (runIds: string[]): Promise<TrunkRunItem[]> => {
  if (runIds.length === 0) return [];
  const { data, error } = await (supabase.from("trunk_run_items" as any) as any)
    .select("*")
    .in("run_id", runIds);
  if (error) throw error;
  return (data as TrunkRunItem[]) || [];
};

/**
 * Bikes waiting to move between the depots, in both directions.
 * Northbound = Scotland-bound bikes sitting at the Birmingham depot.
 * Southbound = bikes at the Scotland depot heading back to the mainland.
 */
export const listTrunkCandidates = async (
  spaceMap: BikeSpaceMap,
): Promise<TrunkCandidate[]> => {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id,tracking_number,status,sender,receiver,bikes,bike_brand,bike_model,bike_type,bike_quantity,storage_locations,scheduled_delivery_date,created_at,updated_at,is_scotland,scotland_direction,scotland_override,current_site_id",
    )
    .eq("is_scotland", true)
    .not("status", "in", `(${FINISHED_ORDER_STATUSES.join(",")})`)
    .limit(1000);

  if (error) throw error;

  const orders = (data as any[]) || [];

  // Exclude bikes already committed to an active run.
  const { data: activeItems } = await (supabase.from("trunk_run_items" as any) as any)
    .select("order_id, trunk_runs!inner(status)")
    .in("trunk_runs.status", ACTIVE_RUN_STATUSES);

  const claimed = new Set(
    ((activeItems as any[]) || []).map((i) => i.order_id).filter(Boolean),
  );

  return orders
    .filter((o) => !claimed.has(o.id))
    .map((o) => toCandidate(o, spaceMap))
    .filter((c) => c.direction !== null)
    .sort((a, b) => b.waiting_days - a.waiting_days);
};

export interface CreateTrunkRunInput {
  run_date: string;
  direction: TrunkDirection;
  origin_site_id: string | null;
  destination_site_id: string | null;
  driver_id: string | null;
  vehicle_id: string | null;
  driver_mode: TrunkDriverMode;
  capacity_spaces: number;
  notes?: string | null;
}

export const createTrunkRun = async (input: CreateTrunkRunInput): Promise<TrunkRun> => {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await (supabase.from("trunk_runs" as any) as any)
    .insert({ ...input, created_by: auth?.user?.id ?? null })
    .select()
    .single();
  if (error) throw error;
  return data as TrunkRun;
};

export const updateTrunkRun = async (
  id: string,
  updates: Partial<TrunkRun>,
): Promise<void> => {
  const { error } = await (supabase.from("trunk_runs" as any) as any)
    .update(updates)
    .eq("id", id);
  if (error) throw error;
};

export const deleteTrunkRun = async (id: string): Promise<void> => {
  const { error } = await (supabase.from("trunk_runs" as any) as any).delete().eq("id", id);
  if (error) throw error;
};

export const addItemsToRun = async (
  runId: string,
  candidates: TrunkCandidate[],
): Promise<void> => {
  if (candidates.length === 0) return;
  const rows = candidates.map((c) => ({
    run_id: runId,
    order_id: c.id,
    spaces: c.spaces,
    origin_bay: c.storage_labels[0] ?? null,
  }));
  const { error } = await (supabase.from("trunk_run_items" as any) as any)
    .upsert(rows, { onConflict: "run_id,order_id" });
  if (error) throw error;
};

export const removeRunItem = async (itemId: string): Promise<void> => {
  const { error } = await (supabase.from("trunk_run_items" as any) as any)
    .delete()
    .eq("id", itemId);
  if (error) throw error;
};

const statusForStage = (
  direction: TrunkDirection,
  stage: "loaded" | "departed" | "arrived",
): string => {
  if (direction === "northbound") {
    if (stage === "arrived") return "at_scotland_depot";
    if (stage === "departed") return "in_transit_to_scotland";
    return "awaiting_trunk_to_scotland";
  }
  if (stage === "arrived") return "awaiting_depot";
  if (stage === "departed") return "in_transit_to_depot";
  return "awaiting_trunk_to_depot";
};

/**
 * Move a run to the next stage and mirror it onto the bikes:
 * - loaded: bikes flagged as awaiting the trunk, origin bays released
 * - departed: bikes marked in transit
 * - arrived: bikes marked at the destination site, bays recorded
 */
export const advanceTrunkRun = async (
  run: TrunkRun,
  stage: "loaded" | "departed" | "arrived",
): Promise<void> => {
  const items = await listTrunkRunItems([run.id]);
  const orderIds = items.map((i) => i.order_id).filter(Boolean) as string[];
  const newStatus = statusForStage(run.direction, stage);

  const runUpdates: Partial<TrunkRun> = { status: stage as TrunkRunStatus };
  if (stage === "departed") runUpdates.departed_at = new Date().toISOString();
  if (stage === "arrived") runUpdates.arrived_at = new Date().toISOString();
  await updateTrunkRun(run.id, runUpdates);

  if (orderIds.length === 0) return;

  const orderUpdates: Record<string, any> = { status: newStatus };
  if (stage === "loaded") {
    // Bikes are on the van, so the origin bays are free again.
    orderUpdates.storage_locations = null;
  }
  if (stage === "arrived") {
    orderUpdates.current_site_id = run.destination_site_id;
  }

  const { error } = await supabase
    .from("orders")
    .update(orderUpdates as any)
    .in("id", orderIds);
  if (error) throw error;

  await (supabase.from("trunk_run_items" as any) as any)
    .update({ status: stage })
    .eq("run_id", run.id);
};

export interface TrunkSignals {
  northboundCount: number;
  northboundSpaces: number;
  northboundOldestDays: number;
  southboundCount: number;
  southboundSpaces: number;
  southboundOldestDays: number;
  nextRunDate: string | null;
  capacity: number;
}

export const buildTrunkSignals = (
  candidates: TrunkCandidate[],
  runs: TrunkRun[],
  capacity: number,
): TrunkSignals => {
  const north = candidates.filter((c) => c.direction === "northbound");
  const south = candidates.filter((c) => c.direction === "southbound");
  const sum = (list: TrunkCandidate[]) =>
    Math.round(list.reduce((t, c) => t + c.spaces, 0) * 100) / 100;
  const oldest = (list: TrunkCandidate[]) =>
    list.reduce((m, c) => Math.max(m, c.waiting_days), 0);

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = runs
    .filter((r) => ACTIVE_RUN_STATUSES.includes(r.status) && r.run_date >= today)
    .sort((a, b) => a.run_date.localeCompare(b.run_date));

  return {
    northboundCount: north.length,
    northboundSpaces: sum(north),
    northboundOldestDays: oldest(north),
    southboundCount: south.length,
    southboundSpaces: sum(south),
    southboundOldestDays: oldest(south),
    nextRunDate: upcoming[0]?.run_date ?? null,
    capacity,
  };
};

/** Should we run a trunk? Fires on a full van or a long-waiting bike. */
export const trunkRecommendation = (
  signals: TrunkSignals,
  waitThresholdDays = 5,
): { recommend: boolean; reason: string } | null => {
  const checks: Array<{ dir: string; spaces: number; oldest: number }> = [
    { dir: "northbound", spaces: signals.northboundSpaces, oldest: signals.northboundOldestDays },
    { dir: "southbound", spaces: signals.southboundSpaces, oldest: signals.southboundOldestDays },
  ];
  for (const c of checks) {
    if (c.spaces >= signals.capacity * 0.8) {
      return {
        recommend: true,
        reason: `${c.dir === "northbound" ? "Northbound" : "Southbound"} load is ${c.spaces} of ${signals.capacity} van spaces — worth running now.`,
      };
    }
    if (c.oldest >= waitThresholdDays) {
      return {
        recommend: true,
        reason: `A ${c.dir} bike has been waiting ${c.oldest} days.`,
      };
    }
  }
  return null;
};
