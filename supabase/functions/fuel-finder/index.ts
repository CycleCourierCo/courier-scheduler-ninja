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
    throw new Error(`Auth failed (${res.status}): ${text.substring(0, 300)}`);
  }
  const data = contentType.includes('json') ? JSON.parse(text) : null;
  if (!data) throw new Error(`Auth returned non-JSON: ${text.substring(0, 200)}`);

  const token = data?.data?.access_token || data?.access_token;
  if (!token) throw new Error('No access_token in response');
  return token;
}

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

    if (res.status === 404) {
      console.log(`Pagination done: ${batch - 1} batches for ${key}`);
      break;
    }

    if (res.status === 403 && all.length > 0) {
      console.log(`Token expired at batch ${batch}, refreshing...`);
      try {
        currentToken = await getAccessToken();
        const retry = await fetch(`${url}?batch-number=${batch}`, {
          headers: { 'Authorization': `Bearer ${currentToken}` },
        });
        if (retry.status === 404) break;
        if (!retry.ok) { console.warn(`Retry failed at ${batch}, stopping`); break; }
        const rd = await retry.json();
        const ri = extractArray(rd, key);
        if (ri?.length) { all.push(...ri); console.log(`Batch ${batch} (retry): ${ri.length} items`); }
        batch++;
        continue;
      } catch { console.warn('Refresh failed, stopping'); break; }
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      if (all.length > 0) { console.warn(`Error at batch ${batch}, stopping with ${all.length} items`); break; }
      throw new Error(`API error ${res.status} at batch ${batch}: ${body.substring(0, 200)}`);
    }

    const data = await res.json();
    const items = extractArray(data, key);
    if (!items || items.length === 0) break;

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

      const token = await getAccessToken();

      // Fetch sequentially — API allows only 1 concurrent request per client
      console.log('Fetching stations...');
      const stations = await fetchAllBatches(
        'https://www.fuel-finder.service.gov.uk/api/v1/pfs',
        token,
        'petrol_filling_stations'
      );
      console.log(`Stations: ${stations.length}`);

      console.log('Fetching prices...');
      const prices = await fetchAllBatches(
        'https://www.fuel-finder.service.gov.uk/api/v1/pfs/fuel-prices',
        token,
        'fuel_prices'
      );
      console.log(`Prices: ${prices.length}`);

      // Debug: log first entry of each to verify field names
      if (stations.length > 0) console.log('Station sample:', JSON.stringify(stations[0]).substring(0, 600));
      if (prices.length > 0) console.log('Price sample:', JSON.stringify(prices[0]).substring(0, 600));

      if (stations.length === 0) {
        return new Response(JSON.stringify({ stations: [], count: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Build price lookup by node_id
      // Price structure: { node_id, fuel_prices: [{ fuel_type: "B7", price: "0120.0000", price_last_updated: "..." }] }
      const priceMap = new Map<string, { price: number; updated: string }>();
      for (const p of prices) {
        const nodeId = String(p.node_id || p.site_id || p.siteId || '');
        if (!nodeId) continue;

        const fuelPrices = p.fuel_prices || p.prices || [];
        if (Array.isArray(fuelPrices)) {
          for (const fp of fuelPrices) {
            const grade = String(fp.fuel_type || fp.grade || '');
            if (grade === 'B7' || grade.toLowerCase().includes('diesel')) {
              const priceVal = parseFloat(String(fp.price));
              if (!isNaN(priceVal)) {
                priceMap.set(nodeId, {
                  price: priceVal,
                  updated: fp.price_last_updated || fp.last_updated || fp.updated_at || '',
                });
              }
              break;
            }
          }
        }
        // Fallback: top-level B7
        if (p.B7 && !priceMap.has(nodeId)) {
          priceMap.set(nodeId, { price: Number(p.B7), updated: p.B7_updated || '' });
        }
      }
      console.log(`Price map: ${priceMap.size} entries`);

      // Filter stations by distance
      const results: any[] = [];
      for (const s of stations) {
        const nodeId = String(s.node_id || s.site_id || s.siteId || '');
        const lat = Number(s.location?.latitude || s.lat || 0);
        const lon = Number(s.location?.longitude || s.lon || 0);
        if (!lat || !lon) continue;

        let distKm: number;
        if (mode === 'depot') {
          distKm = haversineKm(DEPOT_LAT, DEPOT_LON, lat, lon);
        } else {
          distKm = distanceToSegmentKm(lat, lon, originLat!, originLon!, destLat!, destLon!);
        }

        if (distKm > radiusKm) continue;

        const priceInfo = priceMap.get(nodeId);
        if (!priceInfo) continue;

        results.push({
          site_id: nodeId,
          brand: s.brand_name || s.mft_organisation_name || s.brand || 'Unknown',
          name: s.trading_name || s.name || 'Unknown Station',
          address: s.location?.address_line_1 || s.address?.street || '',
          postcode: s.location?.postcode || s.address?.postcode || s.postcode || '',
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
