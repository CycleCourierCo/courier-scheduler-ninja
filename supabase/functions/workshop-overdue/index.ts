import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getWorkshopOverdue, STAGE_LABELS, DEFAULT_OVERDUE_LIMITS, type OverdueLimits } from '../_shared/workshopOverdue.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const FROM = 'CCC - Cycle Courier Co. <Ccc@notification.cyclecourierco.com>';
const APP = 'https://booking.cyclecourierco.com/bicycle-inspections';
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

async function sendEmail(to: string[], subject: string, html: string) {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key || !to.length) return false;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, reply_to: 'Info@cyclecourierco.com', subject, html }),
  });
  return r.ok;
}

type Item = { orderId: string | null; ref: string; bike: string; stage: string; days: number; limit: number; mechanicId: string | null; mechanicName: string | null };

async function loadOverdue(sb: any): Promise<Item[]> {
  const { data: s } = await sb.from('workshop_settings').select('overdue_inspection_days, overdue_parts_unordered_days, overdue_parts_ordered_days, overdue_repair_days').limit(1).maybeSingle();
  const limits: OverdueLimits = { ...DEFAULT_OVERDUE_LIMITS, ...(s || {}) };
  const orders: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('orders')
      .select('id, tracking_number, bike_brand, bike_model, status, collection_confirmation_sent_at, created_at')
      .eq('needs_inspection', true).not('status', 'in', '(delivered,cancelled)').range(from, from + 999);
    if (error) throw error;
    orders.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const byOrder = new Map<string, any>();
  const ids = orders.map((o) => o.id);
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await sb.from('bicycle_inspections').select('*, inspection_issues(*)').in('order_id', ids.slice(i, i + 200));
    for (const insp of data || []) if (!byOrder.has(insp.order_id)) byOrder.set(insp.order_id, insp);
  }
  const { data: walkins } = await sb.from('bicycle_inspections').select('*, inspection_issues(*)').is('order_id', null)
    .not('status', 'in', '(inspected,repaired,ship_as_is)');
  const rows = [
    ...orders.map((o) => ({ ...o, inspection: byOrder.get(o.id) || null, issues: byOrder.get(o.id)?.inspection_issues || [] })),
    ...(walkins || []).map((w: any) => ({ id: null, tracking_number: w.reference, bike_brand: w.bike_brand, bike_model: w.bike_model, status: 'workshop_only', collection_confirmation_sent_at: null, inspection: w, issues: w.inspection_issues || [] })),
  ];
  const out: Item[] = [];
  for (const r of rows) {
    const o = getWorkshopOverdue(r, limits);
    if (!o?.overdue) continue;
    out.push({
      orderId: r.id, ref: r.tracking_number || '—', bike: [r.bike_brand, r.bike_model].filter(Boolean).join(' ') || 'Bike',
      stage: STAGE_LABELS[o.stage], days: o.workingDays, limit: o.limit,
      mechanicId: r.inspection?.inspected_by_id || null, mechanicName: r.inspection?.inspected_by_name || null,
    });
  }
  return out.sort((a, b) => b.days - a.days);
}

async function roleEmails(sb: any, role: string) {
  const { data: rs } = await sb.from('user_roles').select('user_id').eq('role', role);
  const uids = (rs || []).map((r: any) => r.user_id);
  if (!uids.length) return [] as { id: string; email: string; name: string | null }[];
  const { data: ps } = await sb.from('profiles').select('id, email, name, account_status').in('id', uids);
  return (ps || []).filter((p: any) => p.email && p.account_status !== 'suspended' && p.account_status !== 'rejected')
    .map((p: any) => ({ id: p.id, email: p.email, name: p.name }));
}

const table = (items: Item[]) => `<table cellpadding="6" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">
<tr style="background:#f1f1f1"><th align="left">Tracking</th><th align="left">Bike</th><th align="left">Stage</th><th align="left">Working days</th><th align="left">Mechanic</th></tr>
${items.map((i) => `<tr style="border-top:1px solid #ddd"><td>${esc(i.ref)}</td><td>${esc(i.bike)}</td><td>${esc(i.stage)}</td><td>${i.days} (limit ${i.limit})</td><td>${esc(i.mechanicName || 'Unassigned')}</td></tr>`).join('')}
</table>`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const body = await req.json().catch(() => ({}));
    const cron = req.headers.get('X-Cron-Secret');
    const isCron = !!cron && cron === Deno.env.get('CRON_SECRET');

    let staff: { id: string; name: string } | null = null;
    if (!isCron) {
      const auth = req.headers.get('Authorization');
      if (!auth) return json({ error: 'Unauthorized' }, 401);
      const { data: { user } } = await sb.auth.getUser(auth.replace('Bearer ', ''));
      if (!user) return json({ error: 'Unauthorized' }, 401);
      const { data: roles } = await sb.from('user_roles').select('role').eq('user_id', user.id);
      if (!(roles || []).some((r: any) => r.role === 'admin' || r.role === 'mechanic')) return json({ error: 'Forbidden' }, 403);
      const { data: p } = await sb.from('profiles').select('name, email').eq('id', user.id).maybeSingle();
      staff = { id: user.id, name: p?.name || p?.email || 'Staff' };
    }

    if (body.action === 'digest') {
      if (!isCron) return json({ error: 'Forbidden' }, 403);
      const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', hour12: false }).format(new Date()));
      if (hour !== 8 && !body.force) return json({ skipped: 'not 8am in London' });
      const items = await loadOverdue(sb);
      if (!items.length) return json({ overdue: 0 });
      const [admins, mechanics] = await Promise.all([roleEmails(sb, 'admin'), roleEmails(sb, 'mechanic')]);
      await sendEmail(admins.map((a) => a.email), `Workshop: ${items.length} bike${items.length === 1 ? '' : 's'} overdue`,
        `<p>These bikes have been in the same workshop stage longer than the time limit (Mon–Fri working days).</p>${table(items)}<p><a href="${APP}">Open inspections</a></p>`);
      for (const m of mechanics) {
        const mine = items.filter((i) => i.mechanicId === m.id || !i.mechanicId);
        if (!mine.length) continue;
        await sendEmail([m.email], `Please update: ${mine.length} overdue workshop bike${mine.length === 1 ? '' : 's'}`,
          `<p>Hi ${esc(m.name || '')},</p><p>These bikes are overdue. Please move them on or update their status (e.g. tick parts ordered / arrived).</p>${table(mine)}<p><a href="${APP}">Open inspections</a></p>`);
      }
      const logs = items.filter((i) => i.orderId).map((i) => ({ order_id: i.orderId, stage: i.stage, days_in_stage: i.days, sent_to: i.mechanicName || 'All mechanics', automatic: true }));
      if (logs.length) await sb.from('inspection_chases').insert(logs);
      return json({ overdue: items.length });
    }

    if (body.action === 'chase') {
      const orderId = String(body.orderId || '');
      if (!/^[0-9a-f-]{36}$/i.test(orderId)) return json({ error: 'Invalid bike' }, 400);
      const item = (await loadOverdue(sb)).find((i) => i.orderId === orderId);
      if (!item) return json({ error: 'This bike is not overdue' }, 400);
      const mechanics = await roleEmails(sb, 'mechanic');
      const to = item.mechanicId ? mechanics.filter((m) => m.id === item.mechanicId) : mechanics;
      const ok = await sendEmail(to.map((m) => m.email), `Chase: ${item.ref} – ${item.stage} for ${item.days} working days`,
        `<p>${esc(staff!.name)} is chasing this bike:</p>${table([item])}<p>Please update it today.</p><p><a href="${APP}">Open inspections</a></p>`);
      if (!ok) return json({ error: 'Email could not be sent' }, 502);
      await sb.from('inspection_chases').insert({ order_id: orderId, stage: item.stage, days_in_stage: item.days, sent_to: item.mechanicName || 'All mechanics', sent_by_id: staff!.id, sent_by_name: staff!.name });
      return json({ sentTo: item.mechanicName || 'all mechanics' });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e: any) {
    console.error('workshop-overdue error:', e?.message);
    return json({ error: 'Something went wrong' }, 500);
  }
});
