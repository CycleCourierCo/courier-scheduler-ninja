import { corsHeaders } from '../_shared/cors.ts';
import { captureException, withSentry } from '../_shared/sentry.ts';

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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  });
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();
  if (!res.ok) {
    console.error(`Auth response status: ${res.status}, content-type: ${contentType}, body: ${text.substring(0, 500)}`);
    throw new Error(`Auth failed (${res.status}): ${text.substring(0, 300)}`);
  }
  const data = contentType.includes('json') ? JSON.parse(text) : null;
  if (!data) {
    throw new Error(`Auth returned non-JSON response: ${text.substring(0, 200)}`);
  }
  const token = data?.data?.access_token || data?.access_token;
  if (!token) {
    console.error('Token response:', JSON.stringify(data).substring(0, 500));
    throw new Error('No access_token in auth response');
  }
  return token;
}

/**
 * Extract array from potentially nested API response.
 * GOV.UK wraps like: { success: true, data: { petrol_filling_stations: [...] } }
 */
function extractArray(response: any, key: string): any[] | null {
  if (!response) return null;
  if (response.data?.[key] && Array.isArray(response.data[key])) return response.data[key];
  if (response[key] && Array.isArray(response[key])) return response[key];
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response)) return response;
  return null;
}

async function fetchAllBatches(url: string, token: string, key: string): Promise<any[]> {
  const all: any[] = [];
  let batch = 1;
  let currentToken = token;

  while (true) {
    const res = await fetch(`${url}?batch-number=${batch}`, {
      headers: { 'Authorization': `Bearer ${currentToken}` },
    });

    // End of pagination
    if (res.status === 404) {
      console.log(`Pagination complete: ${batch - 1} batches for ${key}`);
      break;
    }

    // Token expired mid-pagination — refresh once and retry this batch
    if (res.status === 403 && all.length > 0) {
      console.log(`Token expired at batch ${batch}, refreshing...`);
      try {
        currentToken = await getAccessToken();
        const retry = await fetch(`${url}?batch-number=${batch}`, {
          headers: { 'Authorization': `Bearer ${currentToken}` },
        });
        if (retry.status === 404) {
          console.log(`After refresh, batch ${batch} not found — done`);
          break;
        }
        if (!retry.ok) {
          console.warn(`After refresh, batch ${batch} still failed (${retry.status}), stopping with ${all.length} items`);
          break;
        }
        const retryData = await retry.json();
        const retryItems = extractArray(retryData, key);
        if (retryItems && retryItems.length > 0) {
          all.push(...retryItems);
          console.log(`Batch ${batch} (retry): got ${retryItems.length} ${key} items`);
        }
        batch++;
        continue;
      } catch (refreshErr) {
        console.warn(`Token refresh failed, stopping with ${all.length} items`);
        break;
      }
    }

    if (!res.ok) {
      const errorBody = await res.text().catch(() => 'no body');
      console.error(`API error ${res.status} at batch ${batch}: ${errorBody.substring(0, 300)}`);
      if (all.length > 0) {
        console.warn(`Stopping at batch ${batch} with ${all.length} items collected`);
        break;
      }
      throw new Error(`API error ${res.status} at batch ${batch}`);
    }

    const data = await res.json();
    const items = extractArray(data, key);

    if (!items || items.length === 0) {
      console.log(`Empty response at batch ${batch} for ${key}, stopping`);
      break;
    }

    console.log(`Batch ${batch}: got ${items.length} ${key} items`);
    all.push(...items);
    batch++;
    if (batch > 50) break;
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

      // Use single token, fetch sequentially (API allows 1 concurrent request)
      const token = await getAccessToken();

      console.log('Fetching stations...');
      const stations = await fetchAllBatches(
        'https://www.fuel-finder.service.gov.uk/api/v1/pfs',
        token,
        'petrol_filling_stations'
      );
      console.log(`Total stations: ${stations.length}`);

      console.log('Fetching prices...');
      const prices = await fetchAllBatches(
        'https://www.fuel-finder.service.gov.uk/api/v1/pfs/fuel-prices',
        token,
        'fuel_prices'
      );
      console.log(`Total prices: ${prices.length}`);

      if (stations.length === 0) {
        return new Response(JSON.stringify({ stations: [], count: 0, debug: 'No stations from API' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Log sample data for debugging
      if (prices.length > 0) console.log('Sample price entry:', JSON.stringify(prices[0]).substring(0, 500));
      if (stations.length > 0) console.log('Sample station entry:', JSON.stringify(stations[0]).substring(0, 500));

      // Build price lookup
      const priceMap = new Map<string, { price: number; updated: string }>();
      for (const p of prices) {
        const siteId = String(p.site_id || p.siteId || '');
        if (!siteId) continue;

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
        if (p.B7 && !priceMap.has(siteId)) {
          priceMap.set(siteId, { price: Number(p.B7), updated: p.B7_updated || '' });
        }
      }
      console.log(`Price map: ${priceMap.size} entries`);

      // Filter stations by distance
      const results: any[] = [];
      for (const s of stations) {
        const siteId = String(s.site_id || s.siteId || '');
        const lat = Number(s.location?.latitude || s.lat || s.latitude || 0);
        const lon = Number(s.location?.longitude || s.lon || s.longitude || 0);
        if (!lat || !lon) continue;

        let distKm: number;
        if (mode === 'depot') {
          distKm = haversineKm(DEPOT_LAT, DEPOT_LON, lat, lon);
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
