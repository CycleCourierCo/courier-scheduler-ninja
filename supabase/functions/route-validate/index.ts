// Checks a fixed stop order against Verso's /plan endpoint: does this sequence
// actually fit the day, and does it break any customer window?
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.41.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const DEPOT = { lat: 52.4690197, lon: -1.8757663 };
const SERVICE_S = 900;
const STAFF_ROLES = ['admin', 'sales', 'route_planner'];

const tzOffsetMs = (utcMs: number) => {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/London', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(new Date(utcMs))) if (part.type !== 'literal') p[part.type] = part.value;
  return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute), Number(p.second)) - utcMs;
};
const londonEpoch = (dateStr: string, time: string) => {
  const [h, m] = time.split(':').map(Number);
  const guess = Date.parse(`${dateStr}T00:00:00Z`) + (h || 0) * 3600_000 + (m || 0) * 60_000;
  return Math.round((guess - tzOffsetMs(guess)) / 1000);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const VERSO_API_URL = Deno.env.get('VERSO_API_URL');
    const VERSO_API_KEY = Deno.env.get('VERSO_API_KEY');
    if (!VERSO_API_URL || !VERSO_API_KEY) return json({ error: 'Verso credentials not configured' }, 500);

    const planUrl = (() => {
      const raw = VERSO_API_URL.trim().replace(/\/(?=\?|$)/, '');
      try {
        const url = new URL(raw);
        url.pathname = `${url.pathname.replace(/\/(solve|plan)$/i, '').replace(/\/$/, '')}/plan`;
        if (url.searchParams.has('api_key') && !url.searchParams.get('api_key')) url.searchParams.set('api_key', VERSO_API_KEY);
        return url.toString();
      } catch { return raw; }
    })();

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: 'unauthorized' }, 401);

    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: roleRows } = await admin.from('user_roles').select('role').eq('user_id', userData.user.id);
    if (!((roleRows || []) as any[]).some((r) => STAFF_ROLES.includes(r.role))) return json({ error: 'forbidden' }, 403);

    const body = await req.json().catch(() => ({}));
    const date: string = typeof body?.date === 'string' ? body.date : '';
    const shiftStart: string = /^\d{2}:\d{2}$/.test(body?.shift_start ?? '') ? body.shift_start : '09:00';
    const stops: any[] = Array.isArray(body?.stops) ? body.stops : [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || stops.length === 0) return json({ error: 'A date and at least one stop are needed' }, 400);

    const open = londonEpoch(date, shiftStart);
    const jobs = stops.map((s, i) => ({
      id: i + 1,
      location: [Number(s.lon), Number(s.lat)],
      service: SERVICE_S,
      ...(Array.isArray(s.window) && s.window.length === 2
        ? { time_windows: [[londonEpoch(date, s.window[0]), londonEpoch(date, s.window[1])]] }
        : {}),
    })).filter((j) => Number.isFinite(j.location[0]) && Number.isFinite(j.location[1]));
    if (jobs.length === 0) return json({ error: 'None of those stops have map coordinates' }, 400);

    const payload = {
      vehicles: [{
        id: 1, profile: 'car',
        start: [DEPOT.lon, DEPOT.lat], end: [DEPOT.lon, DEPOT.lat],
        time_window: [open, open + 15 * 3600],
        steps: [{ type: 'start' }, ...jobs.map((j) => ({ type: 'job', id: j.id })), { type: 'end' }],
      }],
      jobs,
      options: { g: true },
    };

    const resp = await fetch(planUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${VERSO_API_KEY}`, 'X-Api-Key': VERSO_API_KEY },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) return json({ error: `Validation failed (${resp.status}): ${(await resp.text()).slice(0, 200)}` }, 502);
    const solution = await resp.json();
    const route = (solution?.routes || [])[0];
    if (!route) return json({ error: 'The optimiser returned no route for that order' }, 502);

    const steps = (route.steps || []).filter((s: any) => s.type === 'job');
    const duration = (Number(route.duration) || 0) + (Number(route.service) || 0) + (Number(route.waiting_time) || 0);
    const violations = steps
      .map((s: any, i: number) => ({ seq: i + 1, order_id: stops[Number(s.job) - 1]?.order_id ?? null, late: Number(s.violations?.length) > 0 }))
      .filter((v: any) => v.late);

    return json({
      date,
      duration_s: duration,
      miles: Math.round(((Number(route.distance) || 0) / 1609.344) * 10) / 10,
      finishes_at: new Date((open + duration) * 1000).toISOString(),
      over_13h: duration > 13 * 3600,
      unassigned: (solution?.unassigned || []).length,
      window_violations: violations,
      etas: steps.map((s: any, i: number) => ({
        seq: i + 1,
        order_id: stops[Number(s.job) - 1]?.order_id ?? null,
        eta: new Date((Number(s.arrival) || open) * 1000).toISOString(),
      })),
    });
  } catch (e) {
    console.error('route-validate error', (e as Error)?.message);
    return json({ error: (e as Error)?.message ?? 'unexpected error' }, 500);
  }
});
