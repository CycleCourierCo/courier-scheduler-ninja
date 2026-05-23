import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface Pt { lat: number; lon: number }
interface Body {
  origin: Pt;
  stops: Pt[];
  destination?: Pt;
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
    if (!body?.origin || !Array.isArray(body?.stops)) {
      return new Response(JSON.stringify({ error: 'origin and stops required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const destination = body.destination ?? body.origin;

    const toWp = (p: Pt) => ({ location: { latLng: { latitude: p.lat, longitude: p.lon } } });

    const reqBody = {
      origin: toWp(body.origin),
      destination: toWp(destination),
      intermediates: body.stops.map(toWp),
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
      polylineEncoding: 'ENCODED_POLYLINE',
    };

    const resp = await fetch(`${GATEWAY_URL}/routes/directions/v2:computeRoutes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': GOOGLE_MAPS_API_KEY,
        'Content-Type': 'application/json',
        'X-Goog-FieldMask': 'routes.polyline.encodedPolyline,routes.distanceMeters,routes.duration,routes.legs.duration',
      },
      body: JSON.stringify(reqBody),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return new Response(JSON.stringify({ error: 'Routes API failed', detail: txt.slice(0, 500) }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await resp.json();
    const route = data?.routes?.[0];
    if (!route?.polyline?.encodedPolyline) {
      return new Response(JSON.stringify({ error: 'No route returned' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const durSec = typeof route.duration === 'string' ? parseInt(route.duration) : 0;
    const legDurationsSec: number[] = Array.isArray(route.legs)
      ? route.legs.map((l: any) => {
          const d = typeof l?.duration === 'string' ? parseInt(l.duration) : 0;
          return Number.isFinite(d) ? d : 0;
        })
      : [];

    return new Response(JSON.stringify({
      encodedPolyline: route.polyline.encodedPolyline,
      distance_m: route.distanceMeters ?? 0,
      duration_s: durSec,
      legDurationsSec,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
