import { corsHeaders } from '@supabase/supabase-js/cors';
import { initSentry, captureException, withSentry } from '../_shared/sentry.ts';

const DEPOT_LAT = 52.4690197;
const DEPOT_LON = -1.8757663;
const MILES_TO_KM = 1.60934;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function distanceToSegmentKm(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return haversineKm(px, py, ax + t * dx, ay + t * dy);
}

async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get('FUEL_FINDER_CLIENT_ID');
  const clientSecret = Deno.env.get('FUEL_FINDER_CLIENT_SECRET');
  if (!clientId || !clientSecret) throw new Error('Fuel Finder credentials not configured');

  const res = await fetch('https://www.fuel-finder.service.gov.uk/api/v1/oauth/generate_access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'fuelfinder.read',
    }).toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Auth failed (${res.status}): ${text.substring(0, 200)}`);
  }
  const data = await res.json();
  // Handle nested response: { data: { access_token: ... } } or { access_token: ... }
  const token = data?.data?.access_token || data?.access_token;
  if (!token) {
    console.error('Token response keys:', JSON.stringify(Object.keys(data)));
    throw new Error('No access_token in auth response');
  }
  return token;
}

/**
 * Safely extract an array from a potentially nested API response.
 * The GOV.UK Fuel Finder API wraps data like:
 *   { success: true, data: { petrol_filling_stations: [...] } }
 * or sometimes:
 *   { petrol_filling_stations: [...] }
 */
function extractArray(response: any, key: string): any[] | null {
  if (!response) return null;
  // Try data.data[key] (double-nested)
  if (response.data?.[key] && Array.isArray(response.data[key])) {
    return response.data[key];
  }
  // Try data[key] (single-nested)
  if (response[key] && Array.isArray(response[key])) {
    return response[key];
  }
  // Try data.data as array
  if (Array.isArray(response.data)) {
    return response.data;
  }
  // Try response as array directly
  if (Array.isArray(response)) {
    return response;
  }
  return null;
}

async function fetchAllBatches(url: string, token: string, key: string): Promise<any[]> {
  const all: any[] = [];
  let batch = 1;
  while (true) {
    const res = await fetch(`${url}?batch-number=${batch}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (res.status === 404) {
      // Normal end-of-pagination signal
      console.log(`Pagination complete: ${batch - 1} batches fetched for ${key}`);
      break;
    }

    if (!res.ok) {
      const errorBody = await res.text().catch(() => 'no body');
      console.error(`API error ${res.status} at batch ${batch} for ${key}: ${errorBody.substring(0, 300)}`);
      // If we already have data, stop gracefully; otherwise throw
      if (all.length > 0) {
        console.warn(`Stopping pagination early at batch ${batch} with ${all.length} items collected`);
        break;
      }
      throw new Error(`API error ${res.status} at batch ${batch}: ${errorBody.substring(0, 200)}`);
    }

    const data = await res.json();
    const items = extractArray(data, key);

    if (!items || items.length === 0) {
      console.log(`No more items at batch ${batch} for ${key}, stopping`);
      break;
    }

    console.log(`Batch ${batch}: got ${items.length} ${key} items`);
    all.push(...items);
    batch++;
    if (batch > 50) break; // safety
  }
  return all;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  return withSentry('fuel-finder', async () => {
    try {
      const body = await req.json();
      const mode = body.mode || 'depot';
      const radiusMiles = mode === 'depot' ? 5 : 2;
      const radiusKm = radiusMiles * MILES_TO_KM;

      let centerLat = DEPOT_LAT;
      let centerLon = DEPOT_LON;
      let originLat: number | undefined, originLon: number | undefined;
      let destLat: number | undefined, destLon: number | undefined;

      if (mode === 'route') {
        originLat = body.origin_lat;
        originLon = body.origin_lon;
        destLat = body.destination_lat;
        destLon = body.destination_lon;
        if (!originLat || !originLon || !destLat || !destLon) {
          return new Response(JSON.stringify({ error: 'Origin and destination coordinates required for route mode' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // Get a fresh token for each endpoint to avoid expiry mid-pagination
      const stationsToken = await getAccessToken();
      console.log('Fetching stations...');
      const stations = await fetchAllBatches(
        'https://www.fuel-finder.service.gov.uk/api/v1/pfs',
        stationsToken,
        'petrol_filling_stations'
      );
      console.log(`Total stations fetched: ${stations.length}`);

      const pricesToken = await getAccessToken();
      console.log('Fetching prices...');
      const prices = await fetchAllBatches(
        'https://www.fuel-finder.service.gov.uk/api/v1/pfs/fuel-prices',
        pricesToken,
        'fuel_prices'
      );
      console.log(`Total prices fetched: ${prices.length}`);

      if (stations.length === 0) {
        console.warn('No stations returned from API');
        return new Response(JSON.stringify({ stations: [], count: 0, debug: 'No stations from API' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Build price lookup
      const priceMap = new Map<string, { price: number; updated: string }>();
      for (const p of prices) {
        const siteId = String(p.site_id || p.siteId || '');
        if (!siteId) continue;

        // Look for diesel (B7) price in nested fuel_prices array
        const fuelPrices = p.fuel_prices || p.prices || [];
        if (Array.isArray(fuelPrices)) {
          for (const fp of fuelPrices) {
            const grade = String(fp.fuel_type || fp.grade || fp.fuelType || '');
            if (grade === 'B7' || grade.toLowerCase().includes('diesel')) {
              priceMap.set(siteId, {
                price: Number(fp.price),
                updated: fp.last_updated || fp.updated_at || fp.lastUpdated || '',
              });
              break;
            }
          }
        }
        // Also check top-level B7
        if (p.B7 && !priceMap.has(siteId)) {
          priceMap.set(siteId, { price: Number(p.B7), updated: p.B7_updated || '' });
        }
      }
      console.log(`Price map size: ${priceMap.size}`);

      // Filter stations by distance
      const results: any[] = [];
      for (const s of stations) {
        const siteId = String(s.site_id || s.siteId || '');
        const lat = Number(s.location?.latitude || s.lat || s.latitude || 0);
        const lon = Number(s.location?.longitude || s.lon || s.longitude || 0);
        if (!lat || !lon) continue;

        let distKm: number;
        if (mode === 'depot') {
          distKm = haversineKm(centerLat, centerLon, lat, lon);
        } else {
          distKm = distanceToSegmentKm(lat, lon, originLat!, originLon!, destLat!, destLon!);
        }

        if (distKm > radiusKm) continue;

        const priceInfo = priceMap.get(siteId);
        if (!priceInfo) continue;

        results.push({
          site_id: siteId,
          brand: s.brand || s.operator || 'Unknown',
          name: s.name || s.site_name || s.siteName || 'Unknown Station',
          address: s.address?.street || s.address?.address_line_1 || s.street || '',
          postcode: s.address?.postcode || s.postcode || '',
          diesel_price: priceInfo.price,
          last_updated: priceInfo.updated,
          distance_miles: Math.round(distKm / MILES_TO_KM * 10) / 10,
        });
      }

      results.sort((a, b) => a.diesel_price - b.diesel_price);
      console.log(`Results: ${results.length} stations within ${radiusMiles} miles`);

      return new Response(JSON.stringify({ stations: results, count: results.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Fuel finder error:', error);
      captureException(error as Error, { function: 'fuel-finder' });
      return new Response(JSON.stringify({ error: (error as Error).message || 'Failed to fetch fuel prices' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  });
});
