/**
 * Scotland detection.
 *
 * Mirrors the Northern Ireland flow: we rely on the geocoded region already
 * captured on the address (Geoapify `properties.state`, normalised to
 * England / Scotland / Wales / Northern Ireland by `resolveRegion`) rather than
 * maintaining a postcode-prefix list. Orders with no geocode result fall back to
 * the manual override stored on the order.
 */

import { resolveRegion, type RegionAddressLike } from "@/utils/northernIreland";

/** Customer-facing, VAT-inclusive Scotland surcharge per bike. */
export const SCOTLAND_SURCHARGE_PER_BIKE = 0;

export type ScotlandDirection = "northbound" | "southbound" | null;

export function isScotlandAddress(address?: RegionAddressLike | null): boolean {
  if (!address) return false;
  return resolveRegion(address) === "Scotland";
}

/**
 * Direction of a Scotland job.
 * - `northbound`: mainland depot -> Scotland (delivery is in Scotland)
 * - `southbound`: Scotland -> rest of UK (collection is in Scotland)
 */
export function resolveScotlandDirection(
  sender?: RegionAddressLike | null,
  receiver?: RegionAddressLike | null,
): ScotlandDirection {
  if (isScotlandAddress(receiver)) return "northbound";
  if (isScotlandAddress(sender)) return "southbound";
  return null;
}

interface ScotlandOrderLike {
  is_scotland?: boolean | null;
  scotland_direction?: string | null;
  scotland_override?: boolean | null;
  sender?: any;
  receiver?: any;
}

/** Direction stored on the order, falling back to address detection. */
export function scotlandDirectionOf(order: ScotlandOrderLike | null | undefined): ScotlandDirection {
  if (!order) return null;
  if (order.scotland_override === false) return null;
  const stored = order.scotland_direction;
  if (stored === "northbound" || stored === "southbound") return stored;
  const derived = resolveScotlandDirection(order.sender?.address, order.receiver?.address);
  if (derived) return derived;
  if (order.is_scotland || order.scotland_override) return "northbound";
  return null;
}

export function isScotlandOrder(order: ScotlandOrderLike | null | undefined): boolean {
  return scotlandDirectionOf(order) !== null;
}

/** Adds the per-bike Scotland surcharge to a base price. */
export function applyScotlandSurcharge(basePrice: number, isScotland: boolean): number {
  return isScotland ? basePrice + SCOTLAND_SURCHARGE_PER_BIKE : basePrice;
}

export function scotlandDirectionLabel(direction: ScotlandDirection): string {
  if (direction === "northbound") return "To Scotland";
  if (direction === "southbound") return "From Scotland";
  return "";
}
