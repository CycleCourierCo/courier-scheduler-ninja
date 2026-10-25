import { applyTemplateToPayload, saveSample } from "../_shared/emailTemplates.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const FROM = 'CCC - Cycle Courier Co. <Ccc@notification.cyclecourierco.com>';
const APP = 'https://booking.cyclecourierco.com';
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const londonDate = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
const fmt = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

async function sendEmail(key: string, to: string[], subject: string, html: string) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey || !to.length) return false;
  const tpl: any = await applyTemplateToPayload(key, { to, subject, html });
  if (!tpl) return true; // disabled in the Email Centre
  saveSample(key, tpl.subject, tpl.html);
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, ...(tpl.cc ? { cc: tpl.cc } : {}), ...(tpl.bcc ? { bcc: tpl.bcc } : {}), reply_to: 'Info@cyclecourierco.com', subject: tpl.subject, html: tpl.html }),
  });
  return r.ok;
}

async function fleetStaffEmails(sb: any, ids?: string[]) {
  let uids = ids;
  if (!uids) {
    const { data: rs } = await sb.from('user_roles').select('user_id').in('role', ['fleet_manager', 'admin']);
    uids = [...new Set((rs || []).map((r: any) => r.user_id as string))];
  }
  if (!uids.length) return [] as string[];
  const { data: ps } = await sb.from('profiles').select('email, account_status').in('id', uids);
  return (ps || []).filter((p: any) => p.email && !['suspended', 'rejected'].includes(p.account_status)).map((p: any) => p.email as string);
}

const vanLink = (id: string, reg: string) => `<a href="${APP}/fleet/vehicles/${id}">${esc(reg)}</a>`;
const list = (title: string, rows: string[]) => rows.length ? `<h3 style="margin:16px 0 4px">${esc(title)} (${rows.length})</h3><ul>${rows.map((r) => `<li>${r}</li>`).join('')}</ul>` : '';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const cron = req.headers.get('X-Cron-Secret');
    if (!cron || cron !== Deno.env.get('CRON_SECRET')) return json({ error: 'Unauthorized' }, 401);
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const body = await req.json().catch(() => ({}));
    const id = typeof body.id === 'string' && /^[0-9a-f-]{36}$/i.test(body.id) ? body.id : null;

    if (body.action === 'critical_defect' || body.action === 'defect_assigned') {
      if (!id) return json({ error: 'Invalid id' }, 400);
      const { data: d } = await sb.from('vehicle_issues').select('id, title, description, severity, assigned_to, vehicle_id, vehicles(registration)').eq('id', id).maybeSingle();
      if (!d) return json({ skipped: 'not found' });
      const reg = d.vehicles?.registration ?? 'Van';
      if (body.action === 'critical_defect') {
        const ok = await sendEmail('internal.fleet_critical_defect', await fleetStaffEmails(sb), `RED defect on ${reg}: ${d.title}`,
          `<p>A critical (red) defect has been raised on ${vanLink(d.vehicle_id, reg)}.</p><p><strong>${esc(d.title)}</strong>${d.description ? `<br>${esc(d.description)}` : ''}</p><p>The van should not be used until it has been assessed and confirmed safe and legal.</p>`);
        return json({ sent: ok });
      }
      if (!d.assigned_to) return json({ skipped: 'unassigned' });
      const ok = await sendEmail('internal.fleet_defect_assigned', await fleetStaffEmails(sb, [d.assigned_to]), `Defect assigned to you: ${reg} – ${d.title}`,
        `<p>You've been assigned a defect on ${vanLink(d.vehicle_id, reg)}.</p><p><strong>${esc(d.title)}</strong> (${d.severity === 'high' ? 'Red' : d.severity === 'medium' ? 'Amber' : 'Green'})${d.description ? `<br>${esc(d.description)}` : ''}</p>`);
      return json({ sent: ok });
    }

    if (body.action === 'repair_verify') {
      if (!id) return json({ error: 'Invalid id' }, 400);
      const { data: j } = await sb.from('fleet_repair_jobs').select('id, title, vehicle_id, vehicles(registration)').eq('id', id).maybeSingle();
      if (!j) return json({ skipped: 'not found' });
      const reg = j.vehicles?.registration ?? 'Van';
      const ok = await sendEmail('internal.fleet_repair_verify', await fleetStaffEmails(sb), `Repair to verify: ${reg} – ${j.title}`,
        `<p>The repair <strong>${esc(j.title)}</strong> on ${vanLink(j.vehicle_id, reg)} is marked complete and needs checking.</p><p>Open the van's Repairs tab, check the work and enter who verified it.</p>`);
      return json({ sent: ok });
    }

    if (body.action === 'digest') {
      const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', hour12: false }).format(new Date()));
      if (hour !== 7 && !body.force) return json({ skipped: 'not 7am in London' });
      const today = londonDate();
      const { data: s } = await sb.from('fleet_settings').select('reminder_days').eq('id', 1).maybeSingle();
      const horizon = Math.max(...((s?.reminder_days as number[]) ?? [30]), 0);
      const until = londonDate(new Date(Date.now() + horizon * 86400000));
      const reminders = new Set<number>((s?.reminder_days as number[]) ?? [30, 7, 0]);
      const daysTo = (d: string) => Math.round((Date.parse(d) - Date.parse(today)) / 86400000);

      const [{ data: vans }, { data: pols }, { data: defects }, { data: repairs }, { data: intervals }, { data: logs }] = await Promise.all([
        sb.from('vehicles').select('id, registration, status, mot_expiry_date, tax_due_date, next_inspection_due').not('status', 'in', '(sold,written_off)'),
        sb.from('vehicle_insurance_policies').select('vehicle_id, start_date, end_date'),
        sb.from('vehicle_issues').select('vehicle_id, title, created_at').eq('severity', 'high').not('status', 'in', '(resolved,cancelled)'),
        sb.from('fleet_repair_jobs').select('vehicle_id, title, status, booked_for').not('status', 'in', '(verified,closed,cancelled)'),
        sb.from('vehicle_maintenance_intervals').select('id, vehicle_id, service_type, position, custom_name, interval_months'),
        sb.from('vehicle_maintenance_logs').select('vehicle_id, service_type, position, custom_name, service_date'),
      ]);
      const reg = new Map((vans || []).map((v: any) => [v.id, v.registration]));
      const link = (vid: string) => vanLink(vid, reg.get(vid) ?? 'Van');
      const overdueInsp: string[] = [], expiries: string[] = [], red: string[] = [], lateRepairs: string[] = [], verify: string[] = [], maint: string[] = [];

      for (const v of vans || []) {
        if (v.next_inspection_due && v.next_inspection_due < today) overdueInsp.push(`${link(v.id)} – due ${fmt(v.next_inspection_due)}`);
        for (const [label, d] of [['MOT', v.mot_expiry_date], ['Road tax', v.tax_due_date]] as const) {
          if (!d) continue;
          if (d < today) expiries.push(`${link(v.id)} – ${label} expired ${fmt(d)}`);
          else if (d <= until && reminders.has(daysTo(d))) expiries.push(`${link(v.id)} – ${label} due ${fmt(d)} (${daysTo(d)} days)`);
        }
        const cur = (pols || []).filter((p: any) => p.vehicle_id === v.id && p.start_date <= today).sort((a: any, b: any) => b.end_date.localeCompare(a.end_date))[0];
        if (!cur || cur.end_date < today) expiries.push(`${link(v.id)} – no current insurance`);
        else if (reminders.has(daysTo(cur.end_date))) expiries.push(`${link(v.id)} – insurance ends ${fmt(cur.end_date)} (${daysTo(cur.end_date)} days)`);
      }
      for (const d of defects || []) if (reg.has(d.vehicle_id)) red.push(`${link(d.vehicle_id)} – ${esc(d.title)}`);
      for (const j of repairs || []) {
        if (!reg.has(j.vehicle_id)) continue;
        if (j.status === 'completed' || j.status === 'invoiced') verify.push(`${link(j.vehicle_id)} – ${esc(j.title)}`);
        else if (j.booked_for && j.booked_for < today) lateRepairs.push(`${link(j.vehicle_id)} – ${esc(j.title)} (booked ${fmt(j.booked_for)})`);
      }
      for (const i of intervals || []) {
        if (!i.interval_months || !reg.has(i.vehicle_id)) continue;
        const last = (logs || []).filter((l: any) => l.vehicle_id === i.vehicle_id && l.service_type === i.service_type && (l.position ?? null) === (i.position ?? null) && (l.custom_name ?? null) === (i.custom_name ?? null))
          .map((l: any) => l.service_date).sort().at(-1);
        if (!last) continue;
        const due = new Date(last + 'T12:00:00Z'); due.setUTCMonth(due.getUTCMonth() + i.interval_months);
        const dueStr = due.toISOString().slice(0, 10);
        if (dueStr < today) maint.push(`${link(i.vehicle_id)} – ${esc(i.custom_name || String(i.service_type).replace(/_/g, ' '))} overdue since ${fmt(dueStr)}`);
      }

      const total = overdueInsp.length + expiries.length + red.length + lateRepairs.length + verify.length + maint.length;
      if (!total) return json({ items: 0 });
      const html = `<p>Fleet items needing attention today.</p>` +
        list('Critical defects open', red) + list('Overdue safety inspections', overdueInsp) + list('MOT, tax and insurance', expiries) +
        list('Overdue maintenance', maint) + list('Repairs past their booked date', lateRepairs) + list('Repairs awaiting verification', verify) +
        `<p><a href="${APP}/fleet/compliance">Open fleet compliance</a></p>`;
      const ok = await sendEmail('internal.fleet_daily_digest', await fleetStaffEmails(sb), `Fleet: ${total} item${total === 1 ? '' : 's'} need attention`, html);
      return json({ items: total, sent: ok });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e: any) {
    console.error('fleet-alerts error:', e?.message);
    return json({ error: 'Something went wrong' }, 500);
  }
});
