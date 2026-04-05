import { corsHeaders } from '../_shared/cors.ts';
import { captureException, withSentry } from '../_shared/sentry.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

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

function getSupabaseAdmin() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(url, serviceKey);
}

async function handleRefresh(): Promise<Response> {
  console.log('Starting cache refresh...');
  const token = await getAccessToken();

  // Fetch stations and prices sequentially (API only allows 1 concurrent request)
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

  // Build price lookup
  const priceMap = new Map<string, { price: number; updated: string }>();
  for (const p of prices) {
    const nodeId = String(p.node_id || p.site_id || p.siteId || '');
    if (!nodeId) continue;

    const fuelPrices = p.fuel_prices || p.prices || [];
    if (Array.isArray(fuelPrices)) {
      for (const fp of fuelPrices) {
        const grade = String(fp.fuel_type || fp.grade || '');
        if (grade === 'B7' || grade === 'B7_STANDARD' || grade.startsWith('B7') || grade.toLowerCase().includes('diesel')) {
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
    if (p.B7 && !priceMap.has(nodeId)) {
      priceMap.set(nodeId, { price: Number(p.B7), updated: p.B7_updated || '' });
    }
  }
  console.log(`Price map: ${priceMap.size} entries`);

  // Build rows for upsert
  const rows: any[] = [];
  const now = new Date().toISOString();
  for (const s of stations) {
    const nodeId = String(s.node_id || s.site_id || s.siteId || '');
    const lat = Number(s.location?.latitude || s.lat || 0);
    const lon = Number(s.location?.longitude || s.lon || 0);
    if (!lat || !lon || !nodeId) continue;

    const priceInfo = priceMap.get(nodeId);
    rows.push({
      node_id: nodeId,
      brand: s.brand_name || s.mft_organisation_name || s.brand || 'Unknown',
      name: s.trading_name || s.name || 'Unknown Station',
      address: s.location?.address_line_1 || s.address?.street || '',
      postcode: s.location?.postcode || s.address?.postcode || s.postcode || '',
      latitude: lat,
      longitude: lon,
      diesel_price: priceInfo?.price || null,
      last_updated: priceInfo?.updated ? new Date(priceInfo.updated).toISOString() : null,
      cached_at: now,
    });
  }

  console.log(`Upserting ${rows.length} stations to cache...`);
  const sb = getSupabaseAdmin();

  // Upsert in batches of 500
  let upserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error } = await sb
      .from('fuel_station_cache')
      .upsert(batch, { onConflict: 'node_id' });
    if (error) {
      console.error(`Upsert error at batch ${i / 500}:`, error.message);
    } else {
      upserted += batch.length;
    }
  }

  console.log(`Cache refresh complete: ${upserted} stations cached`);
  return new Response(JSON.stringify({ 
    success: true, 
    stations_cached: upserted, 
    prices_found: priceMap.size,
    refreshed_at: now 
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleSearch(body: any): Promise<Response> {
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

  // Read from cache
  const sb = getSupabaseAdmin();
  const { data: cached, error } = await sb
    .from('fuel_station_cache')
    .select('*')
    .not('diesel_price', 'is', null);

  if (error) {
    console.error('Cache read error:', error.message);
    throw new Error('Failed to read fuel station cache');
  }

  if (!cached || cached.length === 0) {
    return new Response(JSON.stringify({ 
      stations: [], 
      count: 0, 
      cached_at: null,
      needs_refresh: true 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Filter by distance
  const results: any[] = [];
  let latestCachedAt: string | null = null;

  for (const s of cached) {
    if (!s.latitude || !s.longitude) continue;

    // Track latest cached_at
    if (!latestCachedAt || s.cached_at > latestCachedAt) {
      latestCachedAt = s.cached_at;
    }

    let distKm: number;
    if (mode === 'depot') {
      distKm = haversineKm(DEPOT_LAT, DEPOT_LON, s.latitude, s.longitude);
    } else {
      distKm = distanceToSegmentKm(s.latitude, s.longitude, originLat!, originLon!, destLat!, destLon!);
    }

    if (distKm > radiusKm) continue;

    results.push({
      site_id: s.node_id,
      brand: s.brand,
      name: s.name,
      address: s.address || '',
      postcode: s.postcode || '',
      latitude: s.latitude,
      longitude: s.longitude,
      diesel_price: Number(s.diesel_price),
      last_updated: s.last_updated || '',
      distance_miles: Math.round(distKm / MILES_TO_KM * 10) / 10,
    });
  }

  results.sort((a, b) => a.diesel_price - b.diesel_price);
  console.log(`Search results: ${results.length} stations within ${radiusMiles} miles (from ${cached.length} cached)`);

  return new Response(JSON.stringify({ 
    stations: results, 
    count: results.length,
    cached_at: latestCachedAt 
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  return withSentry('fuel-finder', async () => {
    try {
      const body = await req.json();
      const mode = body.mode || 'depot';

      if (mode === 'refresh') {
        return await handleRefresh();
      } else {
        return await handleSearch(body);
      }
    } catch (error) {
      console.error('Fuel finder error:', error);
      captureException(error as Error, { function: 'fuel-finder' });
      return new Response(JSON.stringify({ error: (error as Error).message || 'Failed to fetch fuel prices' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  });
});
