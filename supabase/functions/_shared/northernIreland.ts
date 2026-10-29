/**
 * Northern Ireland detection + ferry hand-off details.
 * Shared by edge functions (orders API, Shopify webhook, Shipday, QuickBooks).
 */

/** Customer-facing, VAT-inclusive surcharge (emails, UI, pricing page). */
export const NI_SURCHARGE_PER_BIKE = 120;

/** Net (ex-VAT) surcharge used on QuickBooks invoice lines, where VAT is added via the tax code. */
export const NI_SURCHARGE_NET = 100;

export const CITY_AIR_EXPRESS = {
  displayName: 'Ferry hand-off',
  name: 'City Air Express',
  email: 'Operations.man@cityairexpress.com',
  phone: '+44 7730 145621',
  address: {
    street: 'Unit 1 Ordinal Street, Trafford Park',
    city: 'Manchester',
    state: 'Greater Manchester',
    zipCode: 'M17 1GB',
    country: 'United Kingdom',
  },
  formatted: 'Unit 1 Ordinal Street, Trafford Park, Manchester, M17 1GB',
};

/** Isle of Man surcharge: £180 inc. VAT customer-facing, £150 net on QuickBooks lines. */
export const IOM_SURCHARGE_PER_BIKE = 180;
export const IOM_SURCHARGE_NET = 150;

/** Isle of Man ferry hand-off point (Widnes). */
export const FREIGHT_HUB = {
  displayName: 'Ferry hand-off',
  name: 'Freight Hub',
  email: 'hello@freighthub.im',
  phone: '+44 7624 246112',
  address: {
    street: 'Unit 7, Alexandra Industrial Estate',
    city: 'Widnes',
    state: 'Cheshire',
    zipCode: 'WA8 7AH',
    country: 'United Kingdom',
  },
  formatted: 'Freight Hub, Unit 7, Alexandra Industrial Estate, Widnes, WA8 7AH',
};
export const FREIGHT_HUB_COORDS = { lat: 53.361291, lon: -2.737584 };

export type FerryRegion = 'northern_ireland' | 'isle_of_man';

const normalise = (v?: string | null) => (v || '').trim().toLowerCase();

export function isIsleOfManPostcode(postcode?: string | null): boolean {
  if (!postcode) return false;
  return /^im\d/i.test(postcode.replace(/\s+/g, ''));
}

export function isIsleOfManAddress(address?: Record<string, any> | null): boolean {
  if (!address) return false;
  if ([address.region, address.state, address.country].some((v) => normalise(v).includes('isle of man'))) return true;
  return isIsleOfManPostcode(address.zipCode || address.postcode);
}

export function ferryRegionOfAddress(address?: Record<string, any> | null): FerryRegion | null {
  if (isIsleOfManAddress(address)) return 'isle_of_man';
  if (isNorthernIrelandAddress(address)) return 'northern_ireland';
  return null;
}

export function resolveFerryRegion(sender?: Record<string, any> | null, receiver?: Record<string, any> | null): FerryRegion | null {
  return ferryRegionOfAddress(receiver?.address || receiver) || ferryRegionOfAddress(sender?.address || sender);
}

/** Region stored on the order; older ferry orders default to Northern Ireland. */
export function ferryRegionOf(order: any): FerryRegion | null {
  if (!order) return null;
  const stored = order.ferry_region ?? order.ferryRegion;
  if (stored === 'isle_of_man' || stored === 'northern_ireland') return stored;
  const derived = resolveFerryRegion(order.sender, order.receiver);
  if (derived) return derived;
  return order.is_northern_ireland ? 'northern_ireland' : null;
}

export const ferryRegionLabel = (orderOrRegion: any): string =>
  (typeof orderOrRegion === 'string' ? orderOrRegion : ferryRegionOf(orderOrRegion)) === 'isle_of_man'
    ? 'Isle of Man' : 'Northern Ireland';

export const ferryRegionShort = (orderOrRegion: any): string =>
  (typeof orderOrRegion === 'string' ? orderOrRegion : ferryRegionOf(orderOrRegion)) === 'isle_of_man' ? 'IoM' : 'NI';

/** Partner for the order's ferry region (defaults to the NI partner). */
export function ferryPartnerFor(orderOrRegion: any) {
  const region = typeof orderOrRegion === 'string' ? orderOrRegion : ferryRegionOf(orderOrRegion);
  return region === 'isle_of_man' ? FREIGHT_HUB : CITY_AIR_EXPRESS;
}

export function ferryPartnerCoordsFor(orderOrRegion: any) {
  const region = typeof orderOrRegion === 'string' ? orderOrRegion : ferryRegionOf(orderOrRegion);
  return region === 'isle_of_man' ? FREIGHT_HUB_COORDS : CITY_AIR_EXPRESS_COORDS;
}

export function ferrySurchargeNetFor(orderOrRegion: any): number {
  const region = typeof orderOrRegion === 'string' ? orderOrRegion : ferryRegionOf(orderOrRegion);
  return region === 'isle_of_man' ? IOM_SURCHARGE_NET : region === 'northern_ireland' ? NI_SURCHARGE_NET : 0;
}

export function isNorthernIrelandPostcode(postcode?: string | null): boolean {
  if (!postcode) return false;
  return /^bt\d/i.test(postcode.replace(/\s+/g, ''));
}

export function normaliseRegion(region?: string | null): string | null {
  const r = normalise(region);
  if (!r) return null;
  if (r.includes('northern ireland')) return 'Northern Ireland';
  if (r.includes('scotland')) return 'Scotland';
  if (r.includes('wales') || r.includes('cymru')) return 'Wales';
  if (r.includes('england')) return 'England';
  return null;
}

export function resolveRegion(address?: Record<string, any> | null): string | null {
  if (!address) return null;
  const fromGeocode = normaliseRegion(address.region) || normaliseRegion(address.state);
  if (fromGeocode) return fromGeocode;
  if (isNorthernIrelandPostcode(address.zipCode || address.postcode)) return 'Northern Ireland';
  return null;
}

export function isNorthernIrelandAddress(address?: Record<string, any> | null): boolean {
  if (!address) return false;
  if (resolveRegion(address) === 'Northern Ireland') return true;
  return isNorthernIrelandPostcode(address.zipCode || address.postcode);
}

/** Human-readable NI receiver block used in emails and Shipday instructions. */
export function formatNiReceiverBlock(receiver: any, trackingNumber?: string | null, region?: FerryRegion | null): string {
  const a = receiver?.address || {};
  return [
    `${region === 'isle_of_man' ? 'IoM' : 'NI'} RECEIVER: ${receiver?.name || ''}`,
    `Address: ${[a.street, a.city, a.state, a.zipCode].filter(Boolean).join(', ')}`,
    `Phone: ${receiver?.phone || ''}`,
    `Email: ${receiver?.email || ''}`,
    trackingNumber ? `Tracking: ${trackingNumber}` : '',
  ].filter(Boolean).join('\n');
}

/** Coordinates of the ferry hand-off point (Manchester). */
export const CITY_AIR_EXPRESS_COORDS = { lat: 53.4713, lon: -2.3049 };

export type NiDirection = 'outbound' | 'inbound' | null;

/**
 * Direction of a Northern Ireland job.
 * - `outbound`: mainland -> Northern Ireland (delivery handed over at the ferry point)
 * - `inbound`: Northern Ireland -> mainland (ferry partner collects in NI, we collect in Manchester)
 */
export function resolveNiDirection(
  sender?: Record<string, any> | null,
  receiver?: Record<string, any> | null,
): NiDirection {
  if (ferryRegionOfAddress(receiver?.address || receiver)) return 'outbound';
  if (ferryRegionOfAddress(sender?.address || sender)) return 'inbound';
  return null;
}

/** Direction stored on the order, falling back to address detection. */
export function niDirectionOf(order: any): NiDirection {
  if (!order) return null;
  const stored = order.ni_direction ?? order.niDirection ?? null;
  if (stored === 'outbound' || stored === 'inbound') return stored;
  const derived = resolveNiDirection(order.sender, order.receiver);
  if (derived) return derived;
  return order.is_northern_ireland === true ? 'outbound' : null;
}

export function isOutboundNiOrder(order: any): boolean {
  return niDirectionOf(order) === 'outbound';
}

export function isInboundNiOrder(order: any): boolean {
  return niDirectionOf(order) === 'inbound';
}

/** True when the ferry hand-off point is the stop for this leg. */
export function isFerryLeg(order: any, isPickup: boolean): boolean {
  return isPickup ? isInboundNiOrder(order) : isOutboundNiOrder(order);
}

/** Human-readable NI sender block for inbound jobs (Shipday notes / emails). */
export function formatNiSenderBlock(sender: any, trackingNumber?: string | null, region?: FerryRegion | null): string {
  const a = sender?.address || {};
  return [
    `${region === 'isle_of_man' ? 'IoM' : 'NI'} SENDER: ${sender?.name || ''}`,
    `Address: ${[a.street, a.city, a.state, a.zipCode].filter(Boolean).join(', ')}`,
    `Phone: ${sender?.phone || ''}`,
    `Email: ${sender?.email || ''}`,
    trackingNumber ? `Tracking: ${trackingNumber}` : '',
  ].filter(Boolean).join('\n');
}

/**
 * Isle of Man orders reuse the Northern Ireland wording; swap region names in
 * finished copy so every message stays consistent with the NI version.
 */
export function localiseFerryText(orderOrRegion: any, text: string): string {
  if (!text) return text;
  const region = typeof orderOrRegion === 'string' ? orderOrRegion : ferryRegionOf(orderOrRegion);
  if (region !== 'isle_of_man') return text;
  return text
    .replace(/Northern Ireland/g, 'Isle of Man')
    .replace(/Northern Irish/g, 'Manx')
    .replace(/\bNI\b/g, 'IoM')
    .replace(/City Air Express/g, FREIGHT_HUB.name)
    .replace(/Unit 1 Ordinal Street, Trafford Park, Manchester, M17 1GB/g, FREIGHT_HUB.formatted)
    .replace(/\bManchester\b/g, 'Widnes');
}
