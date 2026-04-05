import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

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
  let t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
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
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Auth failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.access_token;
}

interface Station {
  site_id: string;
  brand: string;
  name: string;
  address: string;
  postcode: string;
  lat: number;
  lon: number;
}

interface FuelPrice {
  site_id: string;
  B7?: number;
  B7_updated?: string;
}

async function fetchAllBatches(url: string, token: string, key: string): Promise<any[]> {
  const all: any[] = [];
  let batch = 1;
  while (true) {
    const res = await fetch(`${url}?batch-number=${batch}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) {
      if (res.status === 404 && batch > 1) break;
      throw new Error(`API error ${res.status} at batch ${batch}`);
    }
    const data = await res.json();
    const items = data[key] || data;
    if (!items || (Array.isArray(items) && items.length === 0)) break;
    all.push(...(Array.isArray(items) ? items : [items]));
    batch++;
    if (batch > 50) break; // safety
  }
  return all;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

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

    const token = await getAccessToken();

    const [stations, prices] = await Promise.all([
      fetchAllBatches('https://www.fuel-finder.service.gov.uk/api/v1/pfs', token, 'petrol_filling_stations'),
      fetchAllBatches('https://www.fuel-finder.service.gov.uk/api/v1/pfs/fuel-prices', token, 'fuel_prices'),
    ]);

    // Build price lookup
    const priceMap = new Map<string, { price: number; updated: string }>();
    for (const p of prices) {
      const siteId = p.site_id || p.siteId;
      // Look for diesel (B7) price
      const fuelPrices = p.fuel_prices || p.prices || [];
      if (Array.isArray(fuelPrices)) {
        for (const fp of fuelPrices) {
          const grade = fp.fuel_type || fp.grade || fp.fuelType || '';
          if (grade === 'B7' || grade.toLowerCase().includes('diesel')) {
            priceMap.set(String(siteId), {
              price: Number(fp.price),
              updated: fp.last_updated || fp.updated_at || fp.lastUpdated || '',
            });
            break;
          }
        }
      }
      // Also check top-level B7
      if (p.B7 && !priceMap.has(String(siteId))) {
        priceMap.set(String(siteId), { price: Number(p.B7), updated: p.B7_updated || '' });
      }
    }

    // Filter stations by distance
    const results: any[] = [];
    for (const s of stations) {
      const siteId = String(s.site_id || s.siteId);
      const lat = Number(s.location?.latitude || s.lat || s.latitude);
      const lon = Number(s.location?.longitude || s.lon || s.longitude);
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

    return new Response(JSON.stringify({ stations: results, count: results.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Fuel finder error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch fuel prices' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
