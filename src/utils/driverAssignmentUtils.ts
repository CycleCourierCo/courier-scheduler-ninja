import { Order } from "@/types/order";

/**
 * Utility functions for handling driver assignments consistently across the application.
 *
 * Matching strategy (in order of reliability):
 *  1. The event's own `leg` field ("pickup" / "delivery") which the Shipday
 *     webhook stamps on every update.
 *  2. The Shipday id stored in the order's tracking block, falling back to the
 *     order's flat `shipday_pickup_id` / `shipday_delivery_id` columns.
 *
 * Some legacy orders have a missing or stale id inside `tracking_events.shipday`
 * (the leg was re-created later), so an id-only match silently loses the driver
 * and proof photos. The leg field keeps those working.
 */

const ASSIGNMENT_EVENTS = new Set(["ORDER_ASSIGNED", "ORDER_ACCEPTED_AND_STARTED"]);

const getLegIds = (order: any, type: "pickup" | "delivery"): string[] => {
  const shipday = order?.trackingEvents?.shipday ?? order?.tracking_events?.shipday;
  const raw =
    type === "pickup"
      ? [shipday?.pickup_id, order?.shipdayPickupId, order?.shipday_pickup_id]
      : [shipday?.delivery_id, order?.shipdayDeliveryId, order?.shipday_delivery_id];
  return raw.filter((v) => v !== null && v !== undefined && v !== "").map((v) => String(v));
};

/** Does this Shipday update belong to the requested leg? */
const matchesLeg = (update: any, type: "pickup" | "delivery", legIds: string[], otherIds: string[]) => {
  if (update?.leg === "pickup" || update?.leg === "delivery") return update.leg === type;

  const id = update?.orderId?.toString();
  if (id && legIds.includes(id)) return true;
  // Fall back to "not the other leg" only when we know the other leg's id.
  if (id && otherIds.length > 0 && !otherIds.includes(id) && legIds.length === 0) return true;
  return false;
};

const sortAssignments = (events: any[]) =>
  [...events].sort((a, b) => {
    const timeA = new Date(a.timestamp || 0).getTime();
    const timeB = new Date(b.timestamp || 0).getTime();
    if (timeA === timeB) {
      if (a.event === "ORDER_ASSIGNED" && b.event === "ORDER_ACCEPTED_AND_STARTED") return 1;
      if (a.event === "ORDER_ACCEPTED_AND_STARTED" && b.event === "ORDER_ASSIGNED") return -1;
    }
    return timeA - timeB;
  });

// Get the most recent driver assignment for pickup or delivery
export const getDriverAssignment = (order: Order, type: "pickup" | "delivery"): string | null => {
  const updates = (order as any)?.trackingEvents?.shipday?.updates ?? (order as any)?.tracking_events?.shipday?.updates;
  if (!Array.isArray(updates) || updates.length === 0) return null;

  const legIds = getLegIds(order, type);
  const otherIds = getLegIds(order, type === "pickup" ? "delivery" : "pickup");

  const assignmentEvents = updates.filter(
    (update: any) =>
      ASSIGNMENT_EVENTS.has(update?.event) && update?.driverName && matchesLeg(update, type, legIds, otherIds)
  );

  if (assignmentEvents.length === 0) return null;

  const sorted = sortAssignments(assignmentEvents);
  return sorted[sorted.length - 1]?.driverName || null;
};

// Get driver name from a completed pickup/delivery event
export const getCompletedDriverName = (order: Order, type: "pickup" | "delivery"): string | null => {
  const updates = (order as any)?.trackingEvents?.shipday?.updates ?? (order as any)?.tracking_events?.shipday?.updates;
  if (!Array.isArray(updates) || updates.length === 0) return null;

  const legIds = getLegIds(order, type);
  const otherIds = getLegIds(order, type === "pickup" ? "delivery" : "pickup");

  const completedEvent = updates.find(
    (update: any) => update?.event === "ORDER_COMPLETED" && matchesLeg(update, type, legIds, otherIds)
  );

  return completedEvent?.driverName || null;
};
