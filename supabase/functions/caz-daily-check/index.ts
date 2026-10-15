import { createClient } from 'npm:@supabase/supabase-js@2';
import { CLEAN_AIR_ZONES } from '../_shared/cleanAirZones.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const DEPOT = { lat: 52.4690197, lon: -1.8757663 };
const GATEWAY_URL = 'https://connector-gateway.lovable.dev/google_maps';
type Pt = { lat: number; lon: number };

function decodePolyline(str: string): [number, number][] {
  let i = 0, lat = 0, lng = 0; const out: [number, number][] = [];
  while (i < str.length) {
    for (const k of [0, 1]) {
      let shift = 0, result = 0, b;
      do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      const d = result & 1 ? ~(result >> 1) : result >> 1;
      if (k === 0) lat += d; else lng += d;
    }
    out.push([lng / 1e5, lat / 1e5]);
  }
  return out;
}

function inRing(p: [number, number], ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function segX(a: number[], b: number[], c: number[], d: number[]) {
  const o = (p: number[], q: number[], r: number[]) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
}
const zoneBoxes = CLEAN_AIR_ZONES.map((z) => {
  const pts = z.polygons.flatMap((p) => p[0]);
  return { z, minX: Math.min(...pts.map((p) => p[0])), maxX: Math.max(...pts.map((p) => p[0])), minY: Math.min(...pts.map((p) => p[1])), maxY: Math.max(...pts.map((p) => p[1])) };
});
function zonesCrossed(line: [number, number][]): string[] {
  const hit: string[] = [];
  for (const { z, minX, maxX, minY, maxY } of zoneBoxes) {
    const near = line.some(([x, y]) => x >= minX - 0.01 && x <= maxX + 0.01 && y >= minY - 0.01 && y <= maxY + 0.01);
    if (!near) continue;
    let found = false;
    for (const poly of z.polygons) {
      const outer = poly[0];
      if (line.some((p) => inRing(p, outer) && !poly.slice(1).some((h) => inRing(p, h)))) { found = true; break; }
      for (let i = 1; i < line.length && !found; i++) {
        for (let j = 1; j < outer.length; j++) if (segX(line[i - 1], line[i], outer[j - 1], outer[j])) { found = true; break; }
      }
      if (found) break;
    }
    if (found) hit.push(z.slug);
  }
  return hit;
}

async function roadLine(points: Pt[]): Promise<[number, number][]> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
  const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY')!;
  const toWp = (p: Pt) => ({ location: { latLng: { latitude: p.lat, longitude: p.lon } } });
  const line: [number, number][] = [];
  // Routes API allows 25 intermediates; chain segments.
  for (let s = 0; s < points.length - 1; s += 26) {
    const seg = points.slice(s, s + 27);
    if (seg.length < 2) break;
    const resp = await fetch(`${GATEWAY_URL}/routes/directions/v2:computeRoutes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': GOOGLE_MAPS_API_KEY,
        'Content-Type': 'application/json',
        'X-Goog-FieldMask': 'routes.polyline.encodedPolyline',
      },
      body: JSON.stringify({
        origin: toWp(seg[0]), destination: toWp(seg[seg.length - 1]),
        intermediates: seg.slice(1, -1).map(toWp), travelMode: 'DRIVE', polylineEncoding: 'ENCODED_POLYLINE',
      }),
    });
    if (!resp.ok) throw new Error(`Routes API ${resp.status}`);
    const enc = (await resp.json())?.routes?.[0]?.polyline?.encodedPolyline;
    if (enc) line.push(...decodePolyline(enc));
  }
  return line;
}

function yesterdayLondon(): string {
  const d = new Date(Date.now() - 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(d);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const cron = req.headers.get('X-Cron-Secret');
    const isCron = !!cron && cron === Deno.env.get('CRON_SECRET');
    if (!isCron) {
      const token = req.headers.get('Authorization')?.replace('Bearer ', '');
      if (!token) return json({ error: 'Unauthorized' }, 401);
      const { data: { user } } = await admin.auth.getUser(token);
      if (!user) return json({ error: 'Unauthorized' }, 401);
      const { data: isAdmin } = await admin.rpc('has_role', { _user_id: user.id, _role: 'admin' });
      if (!isAdmin) return json({ error: 'Forbidden' }, 403);
    }
    const body = await req.json().catch(() => ({}));
    const date = typeof body?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : yesterdayLondon();

    const [{ data: zones }, { data: exemptions }] = await Promise.all([
      admin.from('clean_air_zones').select('slug, daily_charge'),
      admin.from('caz_vehicle_exemptions').select('vehicle_id, zone_slug'),
    ]);
    const charge = new Map((zones || []).map((z: any) => [z.slug, Number(z.daily_charge) || 0]));
    const exempt = new Set((exemptions || []).map((e: any) => `${e.vehicle_id}:${e.zone_slug}`));

    const slips: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin.from('timeslips')
        .select('id, driver_id, vehicle_id, job_locations')
        .eq('date', date).in('status', ['approved', 'draft']).range(from, from + 999);
      if (error) throw error;
      slips.push(...(data || []));
      if (!data || data.length < 1000) break;
    }

    let checked = 0, failed = 0;
    const rows: any[] = [];
    for (let i = 0; i < slips.length; i += 5) {
      await Promise.all(slips.slice(i, i + 5).map(async (t) => {
        const stops = (Array.isArray(t.job_locations) ? t.job_locations : [])
          .filter((l: any) => typeof l?.lat === 'number' && typeof l?.lng === 'number')
          .map((l: any) => ({ lat: l.lat, lon: l.lng }));
        if (!stops.length) return;
        try {
          const line = await roadLine([DEPOT, ...stops, DEPOT]);
          checked++;
          for (const slug of zonesCrossed(line)) {
            const isExempt = !!t.vehicle_id && exempt.has(`${t.vehicle_id}:${slug}`);
            rows.push({
              date, driver_id: t.driver_id, vehicle_id: t.vehicle_id, timeslip_id: t.id, zone_slug: slug,
              exempt: isExempt, charge: isExempt ? 0 : charge.get(slug) ?? 0,
              dedupe_key: `${date}:${t.vehicle_id || 'driver-' + t.driver_id}:${slug}`,
            });
          }
        } catch (_e) { failed++; }
      }));
    }
    // One charge per van (or driver without van) per zone per day.
    const unique = [...new Map(rows.map((r) => [r.dedupe_key, r])).values()];
    if (unique.length) {
      const { error } = await admin.from('caz_charges').upsert(unique, { onConflict: 'dedupe_key', ignoreDuplicates: true });
      if (error) throw error;
    }
    console.log('caz-daily-check', { date, timeslips: slips.length, checked, failed, found: unique.length });
    return json({ date, timeslips: slips.length, checked, failed, found: unique.length });
  } catch (e) {
    console.error('caz-daily-check failed', e instanceof Error ? e.message : 'unknown');
    return json({ error: 'Check failed' }, 500);
  }
});
