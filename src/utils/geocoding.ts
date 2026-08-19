/**
 * Geocoding utility for fetching coordinates from addresses
 * Uses Geoapify API with UK country filter
 */

export interface GeocodingResult {
  lat: number;
  lon: number;
}

export async function geocodeAddress(addressString: string): Promise<GeocodingResult | null> {
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
