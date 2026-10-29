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

const normalise = (v?: string | null) => (v || '').trim().toLowerCase();

export type UkRegion =
  | 'England'
  | 'Scotland'
  | 'Wales'
  | 'Northern Ireland'
  | null;

/** Customer-facing, VAT-inclusive Isle of Man surcharge per bike. */
export const IOM_SURCHARGE_PER_BIKE = 180;

export type FerryRegion = 'northern_ireland' | 'isle_of_man';

export const FERRY_REGION_LABEL: Record<FerryRegion, string> = {
  northern_ireland: 'Northern Ireland',
  isle_of_man: 'Isle of Man',
};

export const FERRY_REGION_SHORT: Record<FerryRegion, string> = {
  northern_ireland: 'NI',
  isle_of_man: 'IoM',
};

export function isIsleOfManPostcode(postcode?: string | null): boolean {
  if (!postcode) return false;
  return /^im\d/i.test(postcode.replace(/\s+/g, ''));
}

export function isIsleOfManAddress(address?: (RegionAddressLike & { city?: string | null }) | null): boolean {
  if (!address) return false;
  if ([address.region, address.state, address.country].some((v) => normalise(v).includes('isle of man'))) return true;
  return isIsleOfManPostcode(address.zipCode || address.postcode);
}

/** Ferry region for one address, or null for mainland Great Britain. */
export function ferryRegionOfAddress(address?: RegionAddressLike | null): FerryRegion | null {
  if (isIsleOfManAddress(address)) return 'isle_of_man';
  if (isNorthernIrelandAddress(address)) return 'northern_ireland';
  return null;
}

/** Ferry region stored on an order, defaulting to NI for older ferry orders. */
export function ferryRegionOf(order: any): FerryRegion | null {
  if (!order) return null;
  const stored = order.ferry_region ?? order.ferryRegion;
  if (stored === 'isle_of_man' || stored === 'northern_ireland') return stored;
  const fromAddr = ferryRegionOfAddress(order.receiver?.address) || ferryRegionOfAddress(order.sender?.address);
  if (fromAddr) return fromAddr;
  return order.is_northern_ireland || order.isNorthernIreland ? 'northern_ireland' : null;
}

export const ferryRegionLabel = (order: any): string =>
  FERRY_REGION_LABEL[ferryRegionOf(order) || 'northern_ireland'];

export const ferrySurchargeFor = (region: FerryRegion | null): number =>
  region === 'isle_of_man' ? IOM_SURCHARGE_PER_BIKE : region === 'northern_ireland' ? NI_SURCHARGE_PER_BIKE : 0;

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

/** Isle of Man orders reuse the NI copy; swap region wording in finished text. */
export function localiseFerryText(orderOrRegion: any, text: string): string {
  if (!text) return text;
  const region = typeof orderOrRegion === 'string' ? orderOrRegion : ferryRegionOf(orderOrRegion);
  if (region !== 'isle_of_man') return text;
  return text
    .replace(/Northern Ireland/g, 'Isle of Man')
    .replace(/\bNI\b/g, 'IoM')
    .replace(/City Air Express/g, 'Freight Hub')
    .replace(/\bManchester\b/g, 'Widnes');
}
