// Workshop overdue rules. Keep in sync with supabase/functions/_shared/workshopOverdue.ts
// (an identical copy used by the morning digest and Chase emails).

export type OverdueStage = "inspection" | "parts_not_ordered" | "parts_not_arrived" | "repair";

export interface OverdueLimits {
  overdue_inspection_days: number;
  overdue_parts_unordered_days: number;
  overdue_parts_ordered_days: number;
  overdue_repair_days: number;
}

export const DEFAULT_OVERDUE_LIMITS: OverdueLimits = {
  overdue_inspection_days: 2,
  overdue_parts_unordered_days: 1,
  overdue_parts_ordered_days: 5,
  overdue_repair_days: 2,
};

export const STAGE_LABELS: Record<OverdueStage, string> = {
  inspection: "Waiting for inspection",
  parts_not_ordered: "Awaiting parts – not ordered",
  parts_not_arrived: "Awaiting parts – ordered, not arrived",
  repair: "Awaiting repair",
};

export interface OverdueResult {
  stage: OverdueStage;
  since: string;
  workingDays: number;
  limit: number;
  overdue: boolean;
}

const londonDate = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

/** Mon–Fri days after the start date, up to and including today (Europe/London). */
export function workingDaysSince(startIso: string, now: Date = new Date()): number {
  const start = londonDate(new Date(startIso));
  const today = londonDate(now);
  if (today <= start) return 0;
  let count = 0;
  const d = new Date(`${start}T12:00:00Z`);
  for (let i = 0; i < 400; i++) {
    d.setUTCDate(d.getUTCDate() + 1);
    const iso = d.toISOString().slice(0, 10);
    if (iso > today) break;
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

const maxIso = (vals: (string | null | undefined)[]) =>
  vals.filter(Boolean).sort().pop() as string | undefined;

const CLOSED_ORDER = new Set(["delivered", "cancelled"]);

/** Works on the inspection-list shape: order fields + `inspection` + `issues`. */
export function getWorkshopOverdue(order: any, limits: OverdueLimits = DEFAULT_OVERDUE_LIMITS, now = new Date()): OverdueResult | null {
  if (!order || CLOSED_ORDER.has(String(order.status || ""))) return null;
  const insp = order.inspection;
  const status = insp?.status;
  const approved = (order.issues || []).filter((i: any) => i.status === "approved");
  const approvedAt = (i: any) => i.receiver_approved_at || i.customer_responded_at || i.updated_at;

  let stage: OverdueStage | null = null;
  let since: string | undefined;
  let limit = 0;

  if (!insp || status === "pending") {
    if (!order.collection_confirmation_sent_at) return null;
    stage = "inspection"; since = order.collection_confirmation_sent_at; limit = limits.overdue_inspection_days;
  } else if (status === "awaiting_parts") {
    const needParts = approved.filter((i: any) => !i.parts_in_stock);
    const unordered = needParts.filter((i: any) => !i.parts_ordered);
    if (unordered.length) {
      stage = "parts_not_ordered"; since = maxIso(unordered.map(approvedAt)); limit = limits.overdue_parts_unordered_days;
    } else if (needParts.some((i: any) => !i.parts_arrived)) {
      stage = "parts_not_arrived"; since = maxIso(needParts.map((i: any) => i.parts_ordered_at)); limit = limits.overdue_parts_ordered_days;
    }
  } else if (status === "awaiting_repair" || status === "in_repair" || status === "cleaning") {
    stage = "repair";
    since = maxIso(approved.flatMap((i: any) => [approvedAt(i), i.parts_arrived_at, i.parts_in_stock_at]));
    limit = limits.overdue_repair_days;
  }

  if (!stage || !since) return null;
  const workingDays = workingDaysSince(since, now);
  return { stage, since, workingDays, limit, overdue: workingDays > limit };
}
