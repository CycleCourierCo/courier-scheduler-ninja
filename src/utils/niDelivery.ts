import { CITY_AIR_EXPRESS } from "@/constants/depot";
import { isNorthernIrelandAddress } from "@/utils/northernIreland";

/**
 * Northern Ireland deliveries are never driven to the customer address — the
 * bike is dropped at City Air Express in Manchester, who handle the Irish Sea
 * crossing. Anywhere the planner builds a delivery stop we must substitute the
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

export const isNiOrder = (order: any): boolean => {
  if (!order) return false;
  if (order.is_northern_ireland === true || order.isNorthernIreland === true) return true;
  const receiverAddress = order.receiver?.address;
  return isNorthernIrelandAddress(receiverAddress);
};

const formatSimple = (a: any) =>
  [a?.street, a?.city, a?.state, a?.zipCode].filter(Boolean).join(", ");

/**
 * Returns the stop the driver actually visits for a delivery leg.
 */
export const getDeliveryDestination = (order: any): DeliveryDestination => {
  const receiver = order?.receiver || {};
  if (!isNiOrder(order)) {
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

  return {
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
    finalDestination: `${receiver.name ? receiver.name + " — " : ""}${formatSimple(receiver.address)}`,
  };
};

/** Contact used for a leg: sender for pickups, NI-aware destination for deliveries. */
export const getLegContact = (order: any, type: "pickup" | "delivery") => {
  if (type === "pickup") {
    const sender = order?.sender || {};
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
 * Foam marker for a delivery leg of a Northern Ireland order. Returns null when
 * the badge shouldn't be shown.
 */
export const getFoamBadge = (
  order: any,
  type?: "pickup" | "delivery" | "break" | string
): FoamBadgeInfo | null => {
  if (!order || !isNiOrder(order)) return null;
  if (type && type !== "delivery") return null;
  const status = order.foam_status ?? order.foamStatus ?? null;
  if (status && FOAMED_STATUSES.includes(status)) {
    return { text: "🧊 Bike foamed", color: "bg-emerald-600 text-white" };
  }
  return { text: "⚠️ Pending foaming", color: "bg-red-600 text-white" };
};
