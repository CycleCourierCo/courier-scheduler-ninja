import { supabase } from "@/integrations/supabase/client";
import { differenceInCalendarDays } from "date-fns";

export type WorkshopQueueKind = "inspect" | "repair";

export interface WorkshopQueueItem {
  key: string;
  kind: WorkshopQueueKind;
  orderId: string;
  inspectionId: string | null;
  trackingNumber: string | null;
  bikeLabel: string;
  /** Day the bike was collected (YYYY-MM-DD) — inspect items only. */
  collectedOn: string | null;
  /** Days since it was collected / since the parts arrived. */
  waitingDays: number;
  minutes: number;
  /** Short note, e.g. how many repairs are ready. */
  note: string | null;
}

const INSPECT_MINUTES = 30;

const bikeLabel = (o: any): string => {
  const parts = [o?.bike_brand, o?.bike_model].filter(Boolean).join(" ").trim();
  return parts || o?.tracking_number || "Bike";
};

const daysSince = (value: string | null): number => {
  if (!value) return 0;
  const d = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(0, differenceInCalendarDays(new Date(), d));
};

export interface WorkshopQueue {
  toInspect: WorkshopQueueItem[];
  repairsReady: WorkshopQueueItem[];
}

/**
 * Bikes that have been collected and still need inspecting, plus bikes whose
 * approved repairs have their parts in and can be worked on now.
 */
export async function fetchWorkshopQueue(hourlyRateGbp: number): Promise<WorkshopQueue> {
  const { data: orders, error: oErr } = await supabase
    .from("orders")
    .select(
      "id, tracking_number, bike_brand, bike_model, created_at, status, needs_inspection, order_collected, pickup_date",
    )
    .eq("needs_inspection", true)
    .eq("order_collected", true)
    .not("status", "in", "(cancelled,delivered)");
  if (oErr) throw oErr;

  const orderRows = (orders || []) as any[];
  if (orderRows.length === 0) return { toInspect: [], repairsReady: [] };

  const orderIds = orderRows.map((o) => o.id);
  const orderById = new Map<string, any>(orderRows.map((o) => [o.id, o]));

  const { data: inspections, error: iErr } = await supabase
    .from("bicycle_inspections")
    .select("id, order_id, status")
    .in("order_id", orderIds);
  if (iErr) throw iErr;

  const inspectionByOrder = new Map<string, any>();
  const inspectionIds: string[] = [];
  (inspections || []).forEach((ins: any) => {
    inspectionByOrder.set(ins.order_id, ins);
    inspectionIds.push(ins.id);
  });

  let issues: any[] = [];
  if (inspectionIds.length > 0) {
    const { data: issueRows, error: isErr } = await supabase
      .from("inspection_issues")
      .select(
        "id, inspection_id, status, labour_cost, parts_arrived, parts_arrived_at, parts_in_stock, part_name, repair_id",
      )
      .in("inspection_id", inspectionIds);
    if (isErr) throw isErr;
    issues = issueRows || [];
  }

  const repairIds = Array.from(
    new Set(issues.map((i) => i.repair_id).filter((r): r is string => !!r)),
  );
  const minutesByRepair = new Map<string, number>();
  if (repairIds.length > 0) {
    const { data: labour, error: lErr } = await supabase
      .from("labour_times")
      .select("repair_id, labour_minutes")
      .in("repair_id", repairIds);
    if (lErr) throw lErr;
    (labour || []).forEach((r: any) => {
      if (r.repair_id != null && r.labour_minutes != null) {
        minutesByRepair.set(String(r.repair_id), Number(r.labour_minutes));
      }
    });
  }

  const issueMinutes = (issue: any): number => {
    if (issue.repair_id && minutesByRepair.has(String(issue.repair_id))) {
      return minutesByRepair.get(String(issue.repair_id)) || 0;
    }
    const cost = Number(issue.labour_cost || 0);
    if (cost > 0 && hourlyRateGbp > 0) return Math.round((cost / hourlyRateGbp) * 60);
    return 0;
  };

  const issuesByInspection = new Map<string, any[]>();
  issues.forEach((i) => {
    const list = issuesByInspection.get(i.inspection_id) || [];
    list.push(i);
    issuesByInspection.set(i.inspection_id, list);
  });

  const toInspect: WorkshopQueueItem[] = [];
  const repairsReady: WorkshopQueueItem[] = [];

  for (const order of orderRows) {
    const ins = inspectionByOrder.get(order.id);
    const collectedOn: string | null = order.pickup_date
      ? String(order.pickup_date).slice(0, 10)
      : null;

    if (!ins || ins.status === "pending") {
      toInspect.push({
        key: `i-${order.id}`,
        kind: "inspect",
        orderId: order.id,
        inspectionId: ins?.id ?? null,
        trackingNumber: order.tracking_number,
        bikeLabel: bikeLabel(order),
        collectedOn,
        waitingDays: daysSince(collectedOn || order.created_at),
        minutes: INSPECT_MINUTES,
        note: null,
      });
      continue;
    }

    if (ins.status === "repaired" || ins.status === "inspected" || ins.status === "ship_as_is") {
      continue;
    }

    const insIssues = issuesByInspection.get(ins.id) || [];
    const ready = insIssues.filter(
      (i) => i.status === "approved" && (i.parts_arrived || i.parts_in_stock),
    );
    if (ready.length === 0) continue;

    const latestArrival = ready
      .map((i) => i.parts_arrived_at as string | null)
      .filter(Boolean)
      .sort()
      .pop() as string | undefined;

    const minutes = ready.reduce((s, i) => s + issueMinutes(i), 0);

    repairsReady.push({
      key: `r-${ins.id}`,
      kind: "repair",
      orderId: order.id,
      inspectionId: ins.id,
      trackingNumber: order.tracking_number,
      bikeLabel: bikeLabel(order),
      collectedOn,
      waitingDays: daysSince(latestArrival || order.created_at),
      minutes: minutes > 0 ? minutes : 30,
      note: `${ready.length} repair${ready.length === 1 ? "" : "s"} ready`,
    });
  }

  // Newest collection first for inspections, longest wait first for repairs.
  toInspect.sort((a, b) => (b.collectedOn || "").localeCompare(a.collectedOn || ""));
  repairsReady.sort((a, b) => b.waitingDays - a.waitingDays);

  return { toInspect, repairsReady };
}
