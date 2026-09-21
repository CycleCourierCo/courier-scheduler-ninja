// Nightly check (00:15 Europe/London): flags order legs whose customer dates have
// all passed, so they never enter route planning silently.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.41.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const STAFF_ROLES = ['admin', 'sales', 'route_planner'];
const londonToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
const dateKey = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(d);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const cronSecret = Deno.env.get('CRON_SECRET');
    const isCron = !!cronSecret && req.headers.get('x-cron-secret') === cronSecret;

    if (!isCron) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);
      const userClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: userData } = await userClient.auth.getUser();
      if (!userData?.user) return json({ error: 'unauthorized' }, 401);
      const { data: roleRows } = await admin.from('user_roles').select('role').eq('user_id', userData.user.id);
      if (!((roleRows || []) as any[]).some((r) => STAFF_ROLES.includes(r.role))) return json({ error: 'forbidden' }, 403);
    }

    const today = londonToday();
    const { data: orders, error } = await admin
      .from('orders')
      .select('id,pickup_date,delivery_date,order_collected,order_delivered,scheduled_pickup_date,scheduled_delivery_date,is_box_my_bike,status')
      .not('status', 'in', '(cancelled,delivered)');
    if (error) throw error;

    const { data: existing } = await admin
      .from('order_leg_availability').select('order_id,leg_type,availability_status');
    const state = new Map<string, string>();
    for (const r of (existing as any[]) || []) state.set(`${r.order_id}:${r.leg_type}`, r.availability_status);

    const now = new Date().toISOString();
    const expired: any[] = [];
    const revived: any[] = [];

    for (const o of ((orders as any[]) || [])) {
      const check = (legType: 'collection' | 'delivery', raw: unknown, eligible: boolean) => {
        if (!eligible) return;
        const dates = [...new Set((Array.isArray(raw) ? raw : []).map(dateKey).filter((d): d is string => !!d))];
        const hasFuture = dates.some((d) => d >= today);
        const current = state.get(`${o.id}:${legType}`) ?? 'active';
        if (dates.length > 0 && !hasFuture && current === 'active') {
          expired.push({ order_id: o.id, leg_type: legType, availability_status: 'expired', availability_expired_at: now });
        } else if (hasFuture && current !== 'active') {
          revived.push({ order_id: o.id, leg_type: legType, availability_status: 'active', availability_expired_at: null, redate_requested_at: null });
        }
      };
      check('collection', o.pickup_date, !o.order_collected && !o.scheduled_pickup_date);
      check('delivery', o.delivery_date, !o.order_delivered && !o.scheduled_delivery_date && !o.is_box_my_bike);
    }

    for (const batch of [expired, revived]) {
      for (let i = 0; i < batch.length; i += 200) {
        const slice = batch.slice(i, i + 200);
        if (slice.length === 0) continue;
        const { error: upsertErr } = await admin
          .from('order_leg_availability').upsert(slice, { onConflict: 'order_id,leg_type' });
        if (upsertErr) throw upsertErr;
      }
    }

    console.log('expire-availability', { expired: expired.length, revived: revived.length });
    return json({ expired: expired.length, revived: revived.length });
  } catch (e) {
    console.error('expire-availability error', (e as Error)?.message);
    return json({ error: (e as Error)?.message ?? 'unexpected error' }, 500);
  }
});
