import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface Stop {
  id: string;
  lat: number;
  lon: number;
}

interface Body {
  origin?: { lat: number; lon: number };
  stops: Stop[];
}

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/google_maps';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) {
      return new Response(JSON.stringify({ error: 'Missing Google Maps connector credentials' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: Body = await req.json();
    if (!body?.stops || !Array.isArray(body.stops) || body.stops.length < 2) {
      return new Response(JSON.stringify({ error: 'At least 2 stops required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stops = body.stops.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lon));
    const origin = body.origin && Number.isFinite(body.origin.lat) ? body.origin : { lat: stops[0].lat, lon: stops[0].lon };

    // Build matrix waypoints: origin + all stops
    const points = [{ id: '__origin', lat: origin.lat, lon: origin.lon }, ...stops];

    const matrixBody = {
      origins: points.map((p) => ({
        waypoint: { location: { latLng: { latitude: p.lat, longitude: p.lon } } },
      })),
      destinations: points.map((p) => ({
        waypoint: { location: { latLng: { latitude: p.lat, longitude: p.lon } } },
      })),
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
    };

    const resp = await fetch(`${GATEWAY_URL}/routes/distanceMatrix/v2:computeRouteMatrix`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': GOOGLE_MAPS_API_KEY,
        'Content-Type': 'application/json',
        'X-Goog-FieldMask': 'originIndex,destinationIndex,duration,distanceMeters,status',
      },
      body: JSON.stringify(matrixBody),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return new Response(JSON.stringify({ error: 'Routes API failed', detail: txt.slice(0, 500) }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rows = await resp.json();
    const n = points.length;
    const dist: number[][] = Array.from({ length: n }, () => Array(n).fill(Infinity));
    const dur: number[][] = Array.from({ length: n }, () => Array(n).fill(Infinity));
    for (const r of rows) {
      const i = r.originIndex, j = r.destinationIndex;
      if (typeof i !== 'number' || typeof j !== 'number') continue;
      dist[i][j] = r.distanceMeters ?? Infinity;
      // duration is "123s"
      const d = typeof r.duration === 'string' ? parseInt(r.duration) : 0;
      dur[i][j] = Number.isFinite(d) ? d : Infinity;
    }

    // Nearest-neighbour from origin (index 0)
    const visited = new Set<number>([0]);
    const order: number[] = [0];
    let cur = 0;
    while (visited.size < n) {
      let best = -1, bestD = Infinity;
      for (let j = 1; j < n; j++) {
        if (visited.has(j)) continue;
        if (dur[cur][j] < bestD) { bestD = dur[cur][j]; best = j; }
      }
      if (best === -1) break;
      visited.add(best); order.push(best); cur = best;
    }

    // 2-opt improvement
    const tourCost = (t: number[]) => {
      let c = 0;
      for (let i = 0; i < t.length - 1; i++) c += dur[t[i]][t[i + 1]];
      return c;
    };
    let improved = true;
    let iters = 0;
    while (improved && iters < 50) {
      improved = false; iters++;
      for (let i = 1; i < order.length - 2; i++) {
        for (let k = i + 1; k < order.length - 1; k++) {
          const newT = order.slice(0, i).concat(order.slice(i, k + 1).reverse(), order.slice(k + 1));
          if (tourCost(newT) + 1 < tourCost(order)) { order.splice(0, order.length, ...newT); improved = true; }
        }
      }
    }

    // Build response — strip origin
    let totalDist = 0, totalDur = 0;
    for (let i = 0; i < order.length - 1; i++) {
      totalDist += dist[order[i]][order[i + 1]];
      totalDur += dur[order[i]][order[i + 1]];
    }
    const sequenced = order.slice(1).map((idx, sequence) => ({
      stop_id: points[idx].id,
      sequence: sequence + 1,
    }));

    return new Response(JSON.stringify({
      sequence: sequenced,
      total_distance_km: totalDist / 1000,
      total_duration_min: totalDur / 60,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
