// Rules for whether a Shipday job may be created for one leg of an order.
// No imports so Vitest can test the exact rules the Edge Function runs.

export type ShipdayLeg = "pickup" | "delivery";

export type ShipdayLegBlock = "cancelled" | "failed_not_rescheduled";

interface ShipdayUpdate {
  event?: string;
  leg?: string;
  orderId?: string | number | null;
  timestamp?: string;
}

export interface ShipdayLegOrder {
  status?: string | null;
  scheduled_pickup_date?: string | null;
  scheduled_delivery_date?: string | null;
  tracking_events?: { shipday?: { updates?: ShipdayUpdate[]; pickup_id?: unknown; delivery_id?: unknown } } | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const isRouteDate = (value: unknown): value is string =>
  typeof value === "string" && DATE_RE.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));

export const isRouteTime = (value: unknown): value is string =>
  typeof value === "string" && TIME_RE.test(value);

/** Latest Shipday event recorded for this leg, e.g. "ORDER_FAILED". */
export function lastShipdayEventForLeg(order: ShipdayLegOrder, leg: ShipdayLeg): string | null {
  const updates = order.tracking_events?.shipday?.updates;
  if (!Array.isArray(updates) || updates.length === 0) return null;
  const forLeg = updates.filter((u) => u && u.leg === leg && typeof u.event === "string");
  if (forLeg.length === 0) return null;
  const latest = [...forLeg].sort((a, b) => String(a.timestamp ?? "").localeCompare(String(b.timestamp ?? ""))).pop();
  return latest?.event ?? null;
}

/**
 * Why a leg must not be sent to Shipday, or null when it may be.
 * - Cancelled orders never go to Shipday.
 * - A leg whose last Shipday attempt failed stays off Shipday until staff give
 *   it a new date (the failure clears the leg's date) or put it on a route.
 */
export function shipdayLegBlock(
  order: ShipdayLegOrder,
  leg: ShipdayLeg,
  routeDate?: string | null,
): ShipdayLegBlock | null {
  if (order.status === "cancelled") return "cancelled";
  if (isRouteDate(routeDate)) return null;
  const scheduled = leg === "pickup" ? order.scheduled_pickup_date : order.scheduled_delivery_date;
  if (!scheduled && lastShipdayEventForLeg(order, leg) === "ORDER_FAILED") return "failed_not_rescheduled";
  return null;
}

export function shipdayLegBlockMessage(block: ShipdayLegBlock, leg: ShipdayLeg): string {
  const what = leg === "pickup" ? "collection" : "delivery";
  if (block === "cancelled") return "This order is cancelled, so it was not sent to Shipday.";
  return `This ${what} failed on Shipday and hasn't been given a new date yet. Reschedule it or add it to a route first.`;
}

/**
 * Day and start time to put on the Shipday job when it is sent from a route.
 * Keeps the customer's already-sent timeslot when the leg is already booked
 * for the route's day; otherwise uses the route's planned time.
 */
export function routeLegSchedule(
  order: ShipdayLegOrder & { pickup_timeslot?: string | null; delivery_timeslot?: string | null },
  leg: ShipdayLeg,
  routeDate: string,
  routeTime?: string | null,
): { date: string; timeslot: string | null } {
  const scheduled = leg === "pickup" ? order.scheduled_pickup_date : order.scheduled_delivery_date;
  const existingSlot = leg === "pickup" ? order.pickup_timeslot : order.delivery_timeslot;
  const scheduledDay = scheduled ? String(scheduled).slice(0, 10) : null;
  if (scheduledDay === routeDate && existingSlot) return { date: routeDate, timeslot: existingSlot };
  return { date: routeDate, timeslot: isRouteTime(routeTime) ? routeTime : (existingSlot ?? null) };
}
