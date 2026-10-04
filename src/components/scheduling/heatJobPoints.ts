import { format } from "date-fns";
import { OrderData } from "@/pages/JobScheduling";
import { getLegContact } from "@/utils/niDelivery";

export interface HeatJobPoint {
  id: string;
  lat: number;
  lon: number;
  type: "collection" | "delivery";
  orderId: string;
  trackingNumber: string;
  bikeQuantity: number;
  /** Days since the order was booked */
  ageDays: number;
  createdAt: string;
  /** Availability dates for this leg */
  availableDates: string[];
}

const dayStr = (d: string | Date) => format(new Date(d), "yyyy-MM-dd");

const daysBetween = (from: string, to: Date) => {
  const start = new Date(from);
  if (isNaN(start.getTime())) return 0;
  const ms = to.getTime() - start.getTime();
  return Math.max(0, Math.floor(ms / 86400000));
};

/** True when this order still needs the collection leg driving. */
export const needsCollectionLeg = (order: OrderData): boolean => {
  if (order.order_collected === true) return false;
  if (["delivered", "cancelled", "collected", "driver_to_delivery", "delivery_scheduled"].includes(order.status as string)) {
    return false;
  }
  return true;
};

/** True when this order still needs the delivery leg driving. */
export const needsDeliveryLeg = (order: OrderData): boolean => {
  if (order.order_delivered === true) return false;
  if (order.is_box_my_bike === true) return false;
  return !["delivered", "cancelled"].includes(order.status as string);
};

/**
 * Turn orders into per-leg map points, with the age and availability data the
 * heat maps need. Mirrors the leg/address handling used by the cluster map so
 * Northern Ireland ferry legs plot at the hand-off point.
 */
export const extractHeatPoints = (
  orders: OrderData[],
  opts?: { includeCollections?: boolean; includeDeliveries?: boolean; now?: Date }
): HeatJobPoint[] => {
  const now = opts?.now ?? new Date();
  const includeCollections = opts?.includeCollections ?? true;
  const includeDeliveries = opts?.includeDeliveries ?? true;
  const points: HeatJobPoint[] = [];

  orders.forEach((order) => {
    const legs: ("collection" | "delivery")[] = [];
    if (includeCollections && needsCollectionLeg(order)) legs.push("collection");
    if (includeDeliveries && needsDeliveryLeg(order)) legs.push("delivery");

    legs.forEach((type) => {
      const isCollection = type === "collection";
      const contact: any = isCollection ? order.sender : getLegContact(order, "delivery");
      const lat = contact?.address?.lat ?? contact?.lat;
      const lon = contact?.address?.lon ?? contact?.lon;
      if (typeof lat !== "number" || typeof lon !== "number") return;

      const rawDates = (isCollection ? order.pickup_date : order.delivery_date) as string[] | null;

      points.push({
        id: `${order.id}-${type}`,
        lat,
        lon,
        type,
        orderId: order.id,
        trackingNumber: order.tracking_number || "",
        bikeQuantity: order.bike_quantity || 1,
        ageDays: daysBetween(order.created_at, now),
        createdAt: order.created_at,
        availableDates: (rawDates || []).map(dayStr),
      });
    });
  });

  return points;
};

export interface AgeBand {
  key: string;
  label: string;
  colour: string;
  marker: "green" | "gold" | "orange" | "red";
  min: number;
  max: number;
}

export const AGE_BANDS: AgeBand[] = [
  { key: "fresh", label: "0-2 days", colour: "#2AAD27", marker: "green", min: 0, max: 2 },
  { key: "warm", label: "3-6 days", colour: "#FFD326", marker: "gold", min: 3, max: 6 },
  { key: "hot", label: "7-13 days", colour: "#CB8427", marker: "orange", min: 7, max: 13 },
  { key: "critical", label: "14+ days", colour: "#CB2B3E", marker: "red", min: 14, max: Infinity },
];

export const bandForAge = (ageDays: number): AgeBand =>
  AGE_BANDS.find((b) => ageDays >= b.min && ageDays <= b.max) ?? AGE_BANDS[0];

/**
 * Is this leg workable on the given date?
 *
 * Collection: leg unscheduled and the sender is available that day.
 * Delivery: leg unscheduled, the bike is already collected (or is being
 * collected before that date), any required inspection work is finished, and
 * the receiver is available that day.
 */
export const isLegViableOnDate = (
  order: OrderData,
  type: "collection" | "delivery",
  targetDate: Date,
  opts?: { collectedOnRoute?: boolean }
): boolean => {
  const target = dayStr(targetDate);
  const pickupDates = ((order.pickup_date as string[] | null) || []).map(dayStr);
  const deliveryDates = ((order.delivery_date as string[] | null) || []).map(dayStr);

  if (type === "collection") {
    if (!needsCollectionLeg(order)) return false;
    if (order.scheduled_pickup_date) return false;
    return pickupDates.includes(target);
  }

  if (!needsDeliveryLeg(order)) return false;
  if (order.scheduled_delivery_date) return false;
  if (!deliveryDates.includes(target)) return false;

  // Customer availability is not a collection. Only a real collection counts:
  // marked collected, or booked for a date from today up to (not incl.) target.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
  const booked = order.scheduled_pickup_date ? dayStr(order.scheduled_pickup_date as string) : null;
  const collectedInTime =
    order.order_collected === true ||
    (!!booked && booked >= today && booked < target) ||
    opts?.collectedOnRoute === true;
  if (!collectedInTime) return false;

  if (order.needs_inspection === true) {
    const done = order.inspection_status === "inspected" || order.inspection_status === "repaired";
    if (!done) return false;
  }

  return true;
};

/**
 * Is this leg expired? It still needs doing, isn't booked onto a date, and
 * every customer availability date has passed (Europe/London). Deliveries
 * keep the same collected/inspection gating as isLegViableOnDate.
 * Northern Ireland legs are excluded, matching the Expiring Dates page.
 */
export const isLegExpired = (
  order: OrderData,
  type: "collection" | "delivery",
  opts?: { collectedOnRoute?: boolean; asOf?: Date }
): boolean => {
  if (order.ni_direction) return false;
  const realToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
  const asOfStr = opts?.asOf ? dayStr(opts.asOf) : realToday;
  const today = asOfStr > realToday ? asOfStr : realToday;

  if (type === "collection") {
    if (!needsCollectionLeg(order)) return false;
    if (order.scheduled_pickup_date) return false;
    const dates = ((order.pickup_date as string[] | null) || []).map(dayStr);
    return dates.length > 0 && dates.every((d) => d < today);
  }

  if (!needsDeliveryLeg(order)) return false;
  if (order.scheduled_delivery_date) return false;
  const dates = ((order.delivery_date as string[] | null) || []).map(dayStr);
  if (dates.length === 0 || !dates.every((d) => d < today)) return false;

  const booked = order.scheduled_pickup_date ? dayStr(order.scheduled_pickup_date as string) : null;
  const collectedInTime =
    order.order_collected === true ||
    (!!booked && booked >= realToday && booked < today) ||
    opts?.collectedOnRoute === true;
  if (!collectedInTime) return false;

  if (order.needs_inspection === true) {
    const done = order.inspection_status === "inspected" || order.inspection_status === "repaired";
    if (!done) return false;
  }

  return true;
};
