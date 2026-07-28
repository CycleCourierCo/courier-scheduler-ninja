/**
 * Northern Ireland detection.
 *
 * The Geoapify autocomplete/geocode response already returns `properties.state`
 * which, for UK addresses, is the constituent country ("England", "Scotland",
 * "Wales", "Northern Ireland"). We capture that as `region` on the address, so
 * no extra Boundaries API call is required.
 *
 * For manually typed addresses (no geocode result) we fall back to the postcode:
 * every Northern Ireland postcode starts with "BT".
 */

export const NI_SURCHARGE_PER_BIKE = 120;

export type UkRegion =
  | 'England'
  | 'Scotland'
  | 'Wales'
  | 'Northern Ireland'
  | null;

const normalise = (v?: string | null) => (v || '').trim().toLowerCase();

export function isNorthernIrelandPostcode(postcode?: string | null): boolean {
  if (!postcode) return false;
  return /^bt\d/i.test(postcode.replace(/\s+/g, ''));
}

export function normaliseRegion(region?: string | null): UkRegion {
  const r = normalise(region);
  if (!r) return null;
  if (r.includes('northern ireland')) return 'Northern Ireland';
  if (r.includes('scotland')) return 'Scotland';
  if (r.includes('wales') || r.includes('cymru')) return 'Wales';
  if (r.includes('england')) return 'England';
  return null;
}

export interface RegionAddressLike {
  region?: string | null;
  state?: string | null;
  zipCode?: string | null;
  postcode?: string | null;
  country?: string | null;
}

/**
 * Resolve the UK region for an address, preferring the geocoded region and
 * falling back to the BT postcode rule.
 */
export function resolveRegion(address?: RegionAddressLike | null): UkRegion {
  if (!address) return null;
  const fromGeocode = normaliseRegion(address.region) || normaliseRegion(address.state);
  if (fromGeocode) return fromGeocode;
  const postcode = address.zipCode || address.postcode;
  if (isNorthernIrelandPostcode(postcode)) return 'Northern Ireland';
  return null;
}

export function isNorthernIrelandAddress(address?: RegionAddressLike | null): boolean {
  if (!address) return false;
  if (resolveRegion(address) === 'Northern Ireland') return true;
  return isNorthernIrelandPostcode(address.zipCode || address.postcode);
}

/** Adds the per-bike Northern Ireland surcharge to a base price. */
export function applyNiSurcharge(basePrice: number, isNi: boolean): number {
  return isNi ? basePrice + NI_SURCHARGE_PER_BIKE : basePrice;
}
