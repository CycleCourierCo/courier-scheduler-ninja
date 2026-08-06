import { CITY_AIR_EXPRESS } from "@/constants/depot";
import { isNorthernIrelandAddress } from "@/utils/northernIreland";

/**
 * Northern Ireland jobs never have a driver at the Northern Irish door.
 *
 * - Outbound (mainland -> NI): the bike is dropped at the ferry hand-off point in
 *   Manchester, who handle the Irish Sea crossing.
 * - Inbound (NI -> mainland): the ferry partner collects from the customer in
 *   Northern Ireland and we collect the bike from the same Manchester hand-off
 *   point, then deliver normally on the mainland.
 *
 * Anywhere the planner builds the ferry-side stop we must substitute the
 * hand-off address so distances, ETAs and route optimisation are correct.
 */

export interface DeliveryDestination {
  name: string;
  phone?: string | null;
  email?: string | null;
  address: any;
  lat?: number | null;
  lon?: number | null;
  isNorthernIreland: boolean;
  /** The customer's real address, only set for NI orders */
  finalDestination?: string | null;
}

export type NiDirection = "outbound" | "inbound" | null;

const formatSimple = (a: any) =>
  [a?.street, a?.city, a?.state, a?.zipCode].filter(Boolean).join(", ");

/** Direction stored on the order, falling back to address detection. */
export const getNiDirection = (order: any): NiDirection => {
  if (!order) return null;
  const stored = order.ni_direction ?? order.niDirection ?? null;
  if (stored === "outbound" || stored === "inbound") return stored;
  if (isNorthernIrelandAddress(order.receiver?.address)) return "outbound";
  if (isNorthernIrelandAddress(order.sender?.address)) return "inbound";
  if (order.is_northern_ireland === true || order.isNorthernIreland === true) return "outbound";
  return null;
};

export const isOutboundNi = (order: any): boolean => getNiDirection(order) === "outbound";
export const isInboundNi = (order: any): boolean => getNiDirection(order) === "inbound";

export const isNiOrder = (order: any): boolean => getNiDirection(order) !== null;

/** True when the ferry hand-off point is the stop the driver actually visits. */
export const isFerryLeg = (order: any, type: "pickup" | "delivery" | string): boolean => {
  if (type === "pickup") return isInboundNi(order);
  if (type === "delivery") return isOutboundNi(order);
  return false;
};

const ferryContact = (finalDestination: string | null): DeliveryDestination => ({
  name: CITY_AIR_EXPRESS.displayName,
  phone: CITY_AIR_EXPRESS.phone,
  email: CITY_AIR_EXPRESS.email,
  address: {
    ...CITY_AIR_EXPRESS.address,
    lat: CITY_AIR_EXPRESS.lat,
    lon: CITY_AIR_EXPRESS.lon,
  },
  lat: CITY_AIR_EXPRESS.lat,
  lon: CITY_AIR_EXPRESS.lon,
  isNorthernIreland: true,
  finalDestination,
});

/**
 * Returns the stop the driver actually visits for a delivery leg.
 */
export const getDeliveryDestination = (order: any): DeliveryDestination => {
  const receiver = order?.receiver || {};
  if (!isOutboundNi(order)) {
    return {
      name: receiver.name,
      phone: receiver.phone,
      email: receiver.email,
      address: receiver.address,
      lat: receiver.address?.lat,
      lon: receiver.address?.lon,
      isNorthernIreland: false,
      finalDestination: null,
    };
  }

  return ferryContact(
    `${receiver.name ? receiver.name + " — " : ""}${formatSimple(receiver.address)}`
  );
};

/**
 * Coordinates the driver actually drives to for a leg. NI ferry legs ALWAYS
 * resolve to the ferry hand-off point — never the customer's NI coordinates.
 */
export const resolveStopCoords = (
  order: any,
  type: "pickup" | "delivery" | "break" | string
): { lat: number | null; lon: number | null } => {
  if (!order || type === "break") return { lat: null, lon: null };
  if (isFerryLeg(order, type)) {
    return { lat: CITY_AIR_EXPRESS.lat, lon: CITY_AIR_EXPRESS.lon };
  }
  const a = (type === "pickup" ? order?.sender?.address : order?.receiver?.address) || {};
  return { lat: a.lat ?? null, lon: a.lon ?? null };
};

/** Contact used for a leg: NI-aware on whichever side hands over at the ferry. */
export const getLegContact = (order: any, type: "pickup" | "delivery") => {
  if (type === "pickup") {
    const sender = order?.sender || {};
    if (isInboundNi(order)) {
      return ferryContact(
        `${sender.name ? sender.name + " — " : ""}${formatSimple(sender.address)}`
      );
    }
    return {
      name: sender.name,
      phone: sender.phone,
      email: sender.email,
      address: sender.address,
      lat: sender.address?.lat,
      lon: sender.address?.lon,
      isNorthernIreland: false,
      finalDestination: null as string | null,
    };
  }
  return getDeliveryDestination(order);
};

// ---- Foam status ----

const FOAMED_STATUSES = ["foamed_ready", "delivered_to_ferry", "delivered_ni"];

export interface FoamBadgeInfo {
  text: string;
  color: string;
}

/**
 * Foam marker for a delivery leg of an outbound Northern Ireland order. Inbound
 * bikes arrive already packed, so no badge is shown. Returns null when the badge
 * shouldn't be shown.
 */
export const getFoamBadge = (
  order: any,
  type?: "pickup" | "delivery" | "break" | string
): FoamBadgeInfo | null => {
  if (!order || !isOutboundNi(order)) return null;
  if (type && type !== "delivery") return null;
  const status = order.foam_status ?? order.foamStatus ?? null;
  if (status && FOAMED_STATUSES.includes(status)) {
    return { text: "🧊 Bike foamed", color: "bg-emerald-600 text-white" };
  }
  return { text: "⚠️ Pending foaming", color: "bg-red-600 text-white" };
};
