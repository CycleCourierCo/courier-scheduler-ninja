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
