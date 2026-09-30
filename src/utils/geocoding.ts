/**
 * Geocoding utility for fetching coordinates from addresses
 * Uses Geoapify API with UK country filter
 */

export interface GeocodingResult {
  lat: number;
  lon: number;
}

const UK_POSTCODE_RE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/i;

function distanceKm(a: GeocodingResult, b: GeocodingResult): number {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Postcode centre from postcodes.io, or null. */
export async function lookupPostcode(postcode: string): Promise<GeocodingResult | null> {
  try {
    const r = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode.replace(/\s+/g, ''))}`);
    if (!r.ok) return null;
    const d = await r.json();
    if (typeof d?.result?.latitude === 'number') return { lat: d.result.latitude, lon: d.result.longitude };
  } catch { /* ignore */ }
  return null;
}

/**
 * Street-level lookups can pick the wrong town (e.g. "Newport" Essex vs Shropshire).
 * If the address contains a postcode and the result is >15 km from it, trust the postcode.
 */
async function checkAgainstPostcode(addressString: string, result: GeocodingResult | null): Promise<GeocodingResult | null> {
  const m = addressString.match(UK_POSTCODE_RE);
  if (!m) return result;
  const pc = await lookupPostcode(`${m[1]}${m[2]}`);
  if (!pc) return result;
  if (!result || distanceKm(result, pc) > 15) return pc;
  return result;
}

export async function geocodeAddress(addressString: string): Promise<GeocodingResult | null> {
  const result = await geocodeAddressRaw(addressString);
  return checkAgainstPostcode(addressString || '', result);
}

async function geocodeAddressRaw(addressString: string): Promise<GeocodingResult | null> {
  if (!addressString || addressString.trim().length === 0) {
    return null;
  }

  try {
    const apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY;
    
    if (!apiKey) {
      console.warn('VITE_GEOAPIFY_API_KEY not configured');
      return null;
    }

    const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(addressString)}&filter=countrycode:gb&apiKey=${apiKey}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error('Geocoding request failed:', response.status);
      return null;
    }

    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      const coords = data.features[0].geometry.coordinates;
      return { 
        lat: coords[1], // Geoapify returns [lon, lat]
        lon: coords[0] 
      };
    }
    
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

/**
 * Geocode a postcode (optionally narrowed by street/city). Falls back to a
 * postcode-only lookup when the fuller address returns nothing.
 */
export async function geocodePostcodeAddress(parts: {
  street?: string | null;
  city?: string | null;
  postcode?: string | null;
}): Promise<GeocodingResult | null> {
  const postcode = parts.postcode?.trim();
  if (!postcode) return null;

  const full = [parts.street, parts.city, postcode, 'United Kingdom']
    .map((p) => (p || '').trim())
    .filter(Boolean)
    .join(', ');

  const detailed = await geocodeAddress(full);
  if (detailed) return detailed;

  return geocodeAddress(`${postcode}, United Kingdom`);
}

/**

 * Build a full address string from address components
 */
export function buildAddressString(address: {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}): string {
  return [
    address.street,
    address.city,
    address.state,
    address.zipCode,
    address.country
  ].filter(Boolean).join(', ');
}
