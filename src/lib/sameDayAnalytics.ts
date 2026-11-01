// Same-day collect & deliver analytics. Pure functions (no imports) so Vitest tests the page's rules.
// A job is "same-day" when its scheduled collection and delivery fall on the same Europe/London date.

export type SameDayOutcome =
  | "success"            // collected and delivered on the planned day, no failed attempts
  | "failed_collection"  // at least one failed collection attempt
  | "failed_delivery"    // collected, but at least one failed delivery attempt
  | "slipped"            // delivered later than planned with no recorded failure
  | "cancelled"
  | "in_progress";

export interface SameDayEvent { event?: string; timestamp?: string; orderId?: string | number; leg?: string; description?: string }

export interface SameDayInput {
  id: string;
  trackingNumber?: string;
  status: string;
  customer?: string;
  scheduledPickupDate?: Date | string | null;
  scheduledDeliveryDate?: Date | string | null;
  pickupId?: string | number | null;
  deliveryId?: string | number | null;
  updates?: SameDayEvent[] | null;
  driver?: string | null;
}

export interface SameDayRow {
  id: string;
  trackingNumber?: string;
  customer?: string;
  plannedDate: string;
  outcome: SameDayOutcome;
  failedCollections: number;
  failedDeliveries: number;
  failReasons: string[];
  deliveredDate?: string;
  turnaroundHours?: number;
  driver?: string | null;
}

export const londonDate = (d: Date | string): string => {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
};

const legOf = (u: SameDayEvent, o: SameDayInput): "pickup" | "delivery" | null => {
  if (u.leg === "pickup" || u.leg === "delivery") return u.leg;
  const id = u.orderId == null ? "" : String(u.orderId);
  if (id && o.pickupId != null && id === String(o.pickupId)) return "pickup";
  if (id && o.deliveryId != null && id === String(o.deliveryId)) return "delivery";
  return null;
};

export const classifySameDay = (o: SameDayInput): SameDayRow | null => {
  if (!o.scheduledPickupDate || !o.scheduledDeliveryDate) return null;
  const planned = londonDate(o.scheduledPickupDate);
  if (planned !== londonDate(o.scheduledDeliveryDate)) return null;

  let failedCollections = 0, failedDeliveries = 0;
  const failReasons: string[] = [];
  let collectedAt: string | undefined, deliveredAt: string | undefined;
  for (const u of o.updates ?? []) {
    const leg = legOf(u, o);
    if (u.event === "ORDER_FAILED") {
      // A failure with no identifiable leg counts as collection only if the bike was never collected yet.
      const isDelivery = leg === "delivery" || (leg === null && !!collectedAt);
      if (isDelivery) failedDeliveries++; else failedCollections++;
      if (u.description) failReasons.push(u.description);
    } else if (u.event === "ORDER_COMPLETED" && u.timestamp) {
      if (leg === "pickup" && !collectedAt) collectedAt = u.timestamp;
      if (leg === "delivery") deliveredAt = u.timestamp;
    }
  }

  let outcome: SameDayOutcome;
  if (o.status === "cancelled") outcome = "cancelled";
  else if (failedCollections > 0) outcome = "failed_collection";
  else if (failedDeliveries > 0) outcome = "failed_delivery";
  else if (deliveredAt || o.status === "delivered") {
    outcome = deliveredAt && londonDate(deliveredAt) !== planned ? "slipped" : "success";
  } else outcome = "in_progress";

  const turnaroundHours = collectedAt && deliveredAt
    ? Math.max(0, (new Date(deliveredAt).getTime() - new Date(collectedAt).getTime()) / 3.6e6)
    : undefined;

  return {
    id: o.id, trackingNumber: o.trackingNumber, customer: o.customer, plannedDate: planned, outcome,
    failedCollections, failedDeliveries, failReasons,
    deliveredDate: deliveredAt ? londonDate(deliveredAt) : undefined, turnaroundHours, driver: o.driver,
  };
};

export interface SameDaySummary {
  total: number;
  finished: number; // excludes in-progress
  success: number;
  failedCollection: number;
  failedDelivery: number;
  slipped: number;
  cancelled: number;
  inProgress: number;
  failedAttempts: number;
  successRate: number; // % of finished (non-cancelled, non-in-progress) jobs done same day first time
  avgTurnaroundHours: number;
}

export const summariseSameDay = (rows: SameDayRow[]): SameDaySummary => {
  const c = (k: SameDayOutcome) => rows.filter((r) => r.outcome === k).length;
  const success = c("success"), failedCollection = c("failed_collection"), failedDelivery = c("failed_delivery");
  const slipped = c("slipped"), cancelled = c("cancelled"), inProgress = c("in_progress");
  const finished = success + failedCollection + failedDelivery + slipped;
  const t = rows.map((r) => r.turnaroundHours).filter((h): h is number => h != null);
  return {
    total: rows.length, finished, success, failedCollection, failedDelivery, slipped, cancelled, inProgress,
    failedAttempts: rows.reduce((s, r) => s + r.failedCollections + r.failedDeliveries, 0),
    successRate: finished ? (success / finished) * 100 : 0,
    avgTurnaroundHours: t.length ? t.reduce((a, b) => a + b, 0) / t.length : 0,
  };
};
