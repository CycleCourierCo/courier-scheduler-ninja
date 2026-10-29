// Staff flag a wrong auto-reply, and admins are emailed once when auto-send switches itself off.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.41.0";
import { identifyCaller } from "../_shared/staffAuth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const UUID = /^[0-9a-f-]{36}$/i;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

async function notifyIfDisabled(admin: any, responseId: string) {
  // Claim the notification so it is only ever sent once per switch-off.
  const { data: claimed } = await admin.from('cs_canned_responses')
    .update({ auto_disabled_notified_at: new Date().toISOString() })
    .eq('id', responseId).not('auto_disabled_at', 'is', null).is('auto_disabled_notified_at', null)
    .select('title, auto_disabled_reason').maybeSingle();
  if (!claimed) return false;
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) return false;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      from: 'Cycle Courier Co. <noreply@notification.cyclecourierco.com>',
      reply_to: 'Info@cyclecourierco.com',
      to: ['info@cyclecourierco.com'],
      subject: `Auto-send switched off: ${claimed.title}`,
      html: `<p>The instant response <strong>${esc(claimed.title)}</strong> has stopped sending automatically.</p>
<p>Reason: ${esc(claimed.auto_disabled_reason || 'confidence dropped')}</p>
<p>Review its recent misses under Customer Service → Queues → Instant responses before switching it back on.</p>`,
    }),
  });
  if (!res.ok) console.error('auto-send disabled email failed', res.status);
  return res.ok;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const caller = await identifyCaller(req);
    const allowed = caller?.kind === 'service' || caller?.roles.some((r) => r === 'admin' || r === 'cs_agent');
    if (!allowed) return json({ error: 'forbidden' }, 403);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const body = await req.json().catch(() => ({}));

    if (body?.action === 'flag') {
      if (!UUID.test(String(body.message_id))) return json({ error: 'message_id required' }, 400);
      const { data: use } = await admin.from('cs_canned_usage').select('id, response_id, flagged_wrong')
        .eq('sent_message_id', body.message_id).eq('auto_sent', true).maybeSingle();
      if (!use) return json({ error: 'Not an auto-sent reply' }, 404);
      if (!use.flagged_wrong) {
        await admin.from('cs_canned_usage').update({
          flagged_wrong: true, flagged_by: caller?.userId ?? null, flagged_at: new Date().toISOString(),
        }).eq('id', use.id);
      }
      await notifyIfDisabled(admin, use.response_id);
      return json({ ok: true });
    }
    if (body?.action === 'check') {
      if (!UUID.test(String(body.response_id))) return json({ error: 'response_id required' }, 400);
      return json({ ok: true, notified: await notifyIfDisabled(admin, body.response_id) });
    }
    return json({ error: 'unknown action' }, 400);
  } catch (e: any) {
    console.error('cs-canned-flag error:', e?.message);
    return json({ error: 'failed' }, 500);
  }
});
