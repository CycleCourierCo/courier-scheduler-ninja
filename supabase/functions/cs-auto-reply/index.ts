// Decides whether a customer message gets an automatic instant response (service role only).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.41.0";
import { identifyCaller } from "../_shared/staffAuth.ts";
import { decideAutoSend, scoreResponses } from "../_shared/cannedConfidence.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const UUID = /^[0-9a-f-]{36}$/i;

function fill(body: string, ctx: Record<string, string>) {
  return body.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, k: string) => ctx[k.toLowerCase()] ?? '');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const caller = await identifyCaller(req);
    if (caller?.kind !== 'service') return json({ error: 'forbidden' }, 403);
    const { conversation_id, message_id } = await req.json().catch(() => ({}));
    if (!UUID.test(String(conversation_id)) || !UUID.test(String(message_id))) return json({ error: 'bad request' }, 400);

    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);

    const { data: msgs } = await admin.from('cs_messages')
      .select('id, direction, author_id, is_automatic, sent_via, system_event, body_text, attachments, created_at')
      .eq('conversation_id', conversation_id).order('created_at', { ascending: false }).limit(30);
    const inbound = (msgs || []).find((m: any) => m.direction === 'in');
    if (!inbound || inbound.id !== message_id) return json({ ok: true, skipped: 'not latest message' });

    const { data: already } = await admin.from('cs_canned_usage').select('id')
      .eq('inbound_message_id', message_id).in('outcome', ['auto_sent', 'trial']).limit(1).maybeSingle();
    if (already) return json({ ok: true, skipped: 'already handled' });

    const { data: conv } = await admin.from('cs_conversations')
      .select('id, status, channel, ticket_ref, linked_order_id, contact:cs_contacts(display_name)')
      .eq('id', conversation_id).maybeSingle();
    if (!conv || conv.status === 'closed') return json({ ok: true, skipped: 'closed' });

    const { data: responses } = await admin.from('cs_canned_responses')
      .select('id, title, body, keywords, is_active, sort_order, auto_send_mode, blocked_from_auto').eq('is_active', true);
    const scored = scoreResponses(inbound.body_text, (responses || []) as any[]);
    const top = scored[0];
    if (!top || top.response.auto_send_mode === 'off') return json({ ok: true, skipped: 'no auto-send match' });

    const { data: stat } = await admin.from('cs_canned_stats').select('uses, confidence').eq('response_id', top.response.id).maybeSingle();
    const outbound = (msgs || []).filter((m: any) => m.direction === 'out' && !m.system_event);
    const lastStaff = outbound.find((m: any) => m.author_id && !m.is_automatic);
    const decision = decideAutoSend({
      text: inbound.body_text || '',
      top: {
        mode: top.response.auto_send_mode, blocked: !!top.response.blocked_from_auto,
        uses: stat?.uses ?? 0, confidence: stat?.confidence == null ? null : Number(stat.confidence), score: top.score,
      },
      runnerUpScore: scored[1]?.score ?? 0,
      channel: conv.channel,
      minsSinceStaffReply: lastStaff ? (Date.now() - new Date(lastStaff.created_at).getTime()) / 60000 : null,
      lastOutboundWasAuto: outbound[0]?.sent_via === 'auto_reply',
      hasAttachmentOnly: !inbound.body_text && Array.isArray(inbound.attachments) && inbound.attachments.length > 0,
    });

    const usageBase = {
      response_id: top.response.id, conversation_id, inbound_message_id: message_id,
      match_score: top.score, runner_up_score: scored[1]?.score ?? 0,
    };
    if (decision.action === 'trial') {
      await admin.from('cs_canned_usage').insert({ ...usageBase, outcome: 'trial' });
      return json({ ok: true, trial: true });
    }
    if (decision.action !== 'send') return json({ ok: true, skipped: decision.reason });

    let order: any = null;
    if (conv.linked_order_id) {
      const { data } = await admin.from('orders').select('tracking_number, customer_order_number, status').eq('id', conv.linked_order_id).maybeSingle();
      order = data;
    }
    const name = String((conv as any).contact?.display_name || '').trim().split(' ')[0] || 'there';
    const text = fill(top.response.body, {
      customer_name: name, ticket_ref: conv.ticket_ref || '',
      tracking_number: order?.tracking_number || order?.customer_order_number || '',
      order_status: order?.status ? String(order.status).replace(/_/g, ' ').toLowerCase() : '',
      my_name: 'Cycle Courier Co.',
    });

    const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/cs-send-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ conversation_id, body_text: text, automatic: true }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || !out?.ok) {
      console.error('auto-reply send failed', res.status);
      return json({ ok: false, error: 'send failed' }, 502);
    }
    await admin.from('cs_canned_usage').insert({ ...usageBase, outcome: 'auto_sent', auto_sent: true, sent_message_id: out.message_id });
    return json({ ok: true, sent: true });
  } catch (e: any) {
    console.error('cs-auto-reply error:', e?.message);
    return json({ error: 'failed' }, 500);
  }
});
