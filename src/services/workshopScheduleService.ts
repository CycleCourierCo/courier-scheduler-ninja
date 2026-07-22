import { supabase } from "@/integrations/supabase/client";
import { differenceInCalendarDays } from "date-fns";

export type WorkshopJobKind = "inspect" | "repair" | "cleaning";

export interface WorkshopJob {
  orderId: string;
  inspectionId: string | null;
  trackingNumber: string | null;
  bikeLabel: string;
  createdAt: string;
  ageDays: number;
  minutes: number;
  kind: WorkshopJobKind;
  cleaningPending: boolean;
  awaitingPart?: string | null; // populated only for awaiting-parts jobs
}

export interface WorkshopScheduleData {
  ready: WorkshopJob[];
  awaitingParts: WorkshopJob[];
  needsInspection: WorkshopJob[];
}

const INSPECT_MINUTES = 10;
const CLEANING_MINUTES = 10;

const bikeLabel = (o: any): string => {
  const parts = [o?.bike_brand, o?.bike_model].filter(Boolean).join(" ").trim();
  return parts || o?.tracking_number || "Bike";
};

export async function fetchWorkshopSchedule(
  hourlyRateGbp: number,
): Promise<WorkshopScheduleData> {
  // 1. Open orders that need inspection at some point in the pipeline.
  const { data: orders, error: oErr } = await supabase
    .from("orders")
    .select("id, tracking_number, bike_brand, bike_model, created_at, status, needs_inspection")
    .eq("needs_inspection", true)
    .not("status", "in", "(cancelled,delivered)");
  if (oErr) throw oErr;
  const orderRows = orders || [];
  const orderById = new Map<string, any>();
  orderRows.forEach((o) => orderById.set(o.id, o));

  if (orderRows.length === 0) {
    return { ready: [], awaitingParts: [], needsInspection: [] };
  }

  const orderIds = orderRows.map((o) => o.id);

  // 2. Their inspections.
  const { data: inspections, error: iErr } = await supabase
    .from("bicycle_inspections")
    .select("id, order_id, status, frame_cleaned_at, drivetrain_degreased_at")
    .in("order_id", orderIds);
  if (iErr) throw iErr;

  const inspectionByOrder = new Map<string, any>();
  const inspectionIds: string[] = [];
  (inspections || []).forEach((ins) => {
    inspectionByOrder.set(ins.order_id, ins);
    inspectionIds.push(ins.id);
  });

  // 3. Issues on those inspections.
  let issues: any[] = [];
  if (inspectionIds.length > 0) {
    const { data: issueRows, error: isErr } = await supabase
      .from("inspection_issues")
      .select(
        "id, inspection_id, status, labour_cost, parts_arrived, part_name, part_number, repair_id",
      )
      .in("inspection_id", inspectionIds);
    if (isErr) throw isErr;
    issues = issueRows || [];
  }

  // 4. Labour minutes lookup.
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

  const issuesByInspection = new Map<string, any[]>();
  issues.forEach((i) => {
    const list = issuesByInspection.get(i.inspection_id) || [];
    list.push(i);
    issuesByInspection.set(i.inspection_id, list);
  });

  const now = new Date();
  const ready: WorkshopJob[] = [];
  const awaitingParts: WorkshopJob[] = [];
  const needsInspection: WorkshopJob[] = [];

  const issueMinutes = (issue: any): number => {
    if (issue.repair_id && minutesByRepair.has(String(issue.repair_id))) {
      return minutesByRepair.get(String(issue.repair_id)) || 0;
    }
    // Fallback: derive from labour_cost using hourly rate
    const cost = Number(issue.labour_cost || 0);
    if (cost > 0 && hourlyRateGbp > 0) {
      return Math.round((cost / hourlyRateGbp) * 60);
    }
    return 0;
  };

  const issueNeedsPart = (issue: any): boolean =>
    !!(issue.part_name || issue.part_number || issue.repair_id);

  for (const order of orderRows) {
    const ins = inspectionByOrder.get(order.id);
    const ageDays = differenceInCalendarDays(now, new Date(order.created_at));
    const cleaningPending = !ins
      ? true
      : !ins.frame_cleaned_at || !ins.drivetrain_degreased_at;

    // No inspection yet, or still pending → needs inspection
    if (!ins || ins.status === "pending") {
      needsInspection.push({
        orderId: order.id,
        inspectionId: ins?.id ?? null,
        trackingNumber: order.tracking_number,
        bikeLabel: bikeLabel(order),
        createdAt: order.created_at,
        ageDays,
        minutes: INSPECT_MINUTES + (cleaningPending ? CLEANING_MINUTES : 0),
        kind: "inspect",
        cleaningPending,
      });
      continue;
    }

    // Finished
    if (ins.status === "repaired" || ins.status === "inspected") continue;

    const insIssues = issuesByInspection.get(ins.id) || [];
    const approved = insIssues.filter((i) =>
      ["approved", "resolved", "repaired"].includes(i.status),
    );
    const pendingApproved = approved.filter((i) => i.status === "approved");

    if (approved.length === 0) {
      // No approved issues → still awaiting pricing/customer response or cleaning only
      if (cleaningPending) {
        needsInspection.push({
          orderId: order.id,
          inspectionId: ins.id,
          trackingNumber: order.tracking_number,
          bikeLabel: bikeLabel(order),
          createdAt: order.created_at,
          ageDays,
          minutes: CLEANING_MINUTES,
          kind: "cleaning",
          cleaningPending: true,
        });
      }
      continue;
    }

    // Do any pending-approved issues still need parts?
    const missingPart = pendingApproved.find(
      (i) => issueNeedsPart(i) && !i.parts_arrived,
    );

    const totalMinutes =
      pendingApproved.reduce((s, i) => s + issueMinutes(i), 0) +
      (cleaningPending ? CLEANING_MINUTES : 0);

    if (missingPart) {
      awaitingParts.push({
        orderId: order.id,
        inspectionId: ins.id,
        trackingNumber: order.tracking_number,
        bikeLabel: bikeLabel(order),
        createdAt: order.created_at,
        ageDays,
        minutes: totalMinutes,
        kind: "repair",
        cleaningPending,
        awaitingPart: missingPart.part_name || missingPart.part_number || "Part",
      });
    } else if (pendingApproved.length > 0) {
      ready.push({
        orderId: order.id,
        inspectionId: ins.id,
        trackingNumber: order.tracking_number,
        bikeLabel: bikeLabel(order),
        createdAt: order.created_at,
        ageDays,
        minutes: totalMinutes,
        kind: "repair",
        cleaningPending,
      });
    } else if (cleaningPending) {
      // Everything approved is already resolved/repaired, only cleaning left
      needsInspection.push({
        orderId: order.id,
        inspectionId: ins.id,
        trackingNumber: order.tracking_number,
        bikeLabel: bikeLabel(order),
        createdAt: order.created_at,
        ageDays,
        minutes: CLEANING_MINUTES,
        kind: "cleaning",
        cleaningPending: true,
      });
    }
  }

  const byOldest = (a: WorkshopJob, b: WorkshopJob) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  ready.sort(byOldest);
  awaitingParts.sort(byOldest);
  needsInspection.sort(byOldest);

  return { ready, awaitingParts, needsInspection };
}

export interface PlannedDay {
  date: Date;
  jobs: WorkshopJob[];
  usedMinutes: number;
}

export function packSchedule(
  jobs: WorkshopJob[],
  capacityMinutes: number,
  holidayDates: string[],
  startFrom: Date = new Date(),
  maxDays: number = 30,
): PlannedDay[] {
  const holidays = new Set(holidayDates);
  const days: PlannedDay[] = [];
  const queue = [...jobs];
  let cursor = new Date(startFrom.getFullYear(), startFrom.getMonth(), startFrom.getDate());
  let safety = 0;

  while (queue.length > 0 && days.length < maxDays && safety < 365) {
    safety += 1;
    const dow = cursor.getDay(); // 0=Sun,6=Sat
    const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
    const isWorkingDay = dow !== 0 && dow !== 6 && !holidays.has(iso);

    if (isWorkingDay) {
      const day: PlannedDay = { date: new Date(cursor), jobs: [], usedMinutes: 0 };
      // Pack in order, allowing a job larger than remaining capacity to spill onto its own day.
      while (queue.length > 0) {
        const next = queue[0];
        if (day.usedMinutes === 0 || day.usedMinutes + next.minutes <= capacityMinutes) {
          day.jobs.push(next);
          day.usedMinutes += next.minutes;
          queue.shift();
        } else {
          break;
        }
      }
      if (day.jobs.length > 0) days.push(day);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}
