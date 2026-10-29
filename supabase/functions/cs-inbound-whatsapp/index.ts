// Inbound WhatsApp webhook (SendZen). Saves messages into the CS inbox and tracks delivery status of replies.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.41.0";
import { resolveOrderLink } from "../_shared/cs-order-linker.ts";
import { parseWhatsAppWebhook, normaliseWaHandle, nextDeliveryStatus } from "../_shared/whatsappInbound.ts";
import { downloadWhatsAppMedia, findPhoneNumberId } from "../_shared/whatsappMediaStore.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sendzen-signature, x-hub-signature-256, x-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function hmacHex(secret: string, body: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function verified(req: Request, raw: string, secret: string) {
  const candidates = [
    req.headers.get('x-sendzen-signature'),
    req.headers.get('x-hub-signature-256'),
    req.headers.get('x-signature'),
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, ''),
  ].filter(Boolean).map((v) => String(v).trim());
  if (!candidates.length) return false;
  const hex = await hmacHex(secret, raw);
  return candidates.some((c) => {
    const v = c.replace(/^sha256=/i, '').toLowerCase();
    return safeEqual(v, hex) || safeEqual(c, secret);
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const expected = Deno.env.get('SENDZEN_INBOUND_SECRET');
    if (!expected) return json({ error: 'inbound not configured' }, 503);
    const raw = await req.text();
    if (!(await verified(req, raw, expected))) return json({ error: 'unauthorized' }, 401);

    let body: any;
    try { body = JSON.parse(raw); } catch { return json({ error: 'invalid json' }, 400); }
    const { messages, statuses, echoes } = parseWhatsAppWebhook(body);

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    // Delivery tracking for our replies
    let statusUpdated = 0;
    for (const s of statuses) {
      const { data: msg } = await supabase.from('cs_messages')
        .select('id, delivery_status, delivery_events')
        .or(`provider_message_id.eq.${s.externalId},external_id.eq.${s.externalId}`)
        .eq('direction', 'out').limit(1).maybeSingle();
      if (!msg) continue;
      const events = Array.isArray(msg.delivery_events) ? msg.delivery_events : [];
      await supabase.from('cs_messages').update({
        delivery_status: nextDeliveryStatus(msg.delivery_status, s.status),
        delivery_events: [...events, { status: s.status, at: new Date().toISOString(), ...(s.error ? { error: s.error } : {}) }],
        ...(s.status === 'failed' && s.error ? { error: s.error.slice(0, 500) } : {}),
      }).eq('id', msg.id);
      statusUpdated++;
    }

    // Replies typed on the WhatsApp Business phone app (message echoes): file under the customer's chat.
    let echoed = 0;
    for (const e of echoes) {
      if (e.externalId) {
        const { data: dup } = await supabase.from('cs_messages').select('id')
          .or(`external_id.eq.${e.externalId},provider_message_id.eq.${e.externalId}`).limit(1).maybeSingle();
        if (dup) continue;
      }
      const handle = normaliseWaHandle(e.to);
      const { data: contactRow, error: contactErr } = await supabase.from('cs_contacts')
        .upsert({ channel: 'whatsapp', handle }, { onConflict: 'channel,handle' }).select().single();
      if (contactErr) throw contactErr;
      const now = new Date().toISOString();
      let { data: conv } = await supabase.from('cs_conversations').select('id')
        .eq('contact_id', contactRow.id).eq('channel', 'whatsapp')
        .order('last_message_at', { ascending: false }).limit(1).maybeSingle();
      if (!conv?.id) {
        const { data: created, error: cErr } = await supabase.from('cs_conversations').insert({
          channel: 'whatsapp', contact_id: contactRow.id, status: 'pending',
          last_message_at: now, last_message_preview: e.text.slice(0, 140), unread_count: 0,
        }).select('id').single();
        if (cErr) throw cErr;
        conv = created;
      } else {
        await supabase.from('cs_conversations').update({ last_message_at: now, last_message_preview: e.text.slice(0, 140) }).eq('id', conv.id);
      }
      let attachments: any[] | undefined;
      if (e.attachment) {
        const pid = findPhoneNumberId(body);
        const withPid = { ...e.attachment, ...(pid ? { phone_number_id: pid } : {}) };
        const stored = await downloadWhatsAppMedia(supabase, conv!.id, withPid);
        attachments = [stored ? { ...withPid, url: stored.url, path: stored.path, size: stored.size }
          : { ...withPid, download_failed: true }];
      }
      const { error: mErr } = await supabase.from('cs_messages').insert({
        conversation_id: conv!.id, direction: 'out', body_text: e.text, external_id: e.externalId,
        provider_message_id: e.externalId, status: 'sent', delivery_status: 'sent', sent_via: 'phone',
        ...(attachments ? { attachments } : {}),
      });
      if (mErr) throw mErr;
      echoed++;
    }

    const saved: string[] = [];
    for (const m of messages) {
      if (m.externalId) {
        const { data: dup } = await supabase.from('cs_messages').select('id')
          .eq('external_id', m.externalId).eq('direction', 'in').limit(1).maybeSingle();
        if (dup) continue;
      }
      const handle = normaliseWaHandle(m.from);
      const { data: contactRow, error: contactErr } = await supabase.from('cs_contacts')
        .upsert({ channel: 'whatsapp', handle, ...(m.name ? { display_name: m.name } : {}) }, { onConflict: 'channel,handle' })
        .select().single();
      if (contactErr) throw contactErr;

      const now = new Date().toISOString();
      // Quote the message being replied to / reacted to so staff see the context.
      let bodyText = m.text;
      if (m.replyTo) {
        const { data: quoted } = await supabase.from('cs_messages').select('body_text')
          .or(`external_id.eq.${m.replyTo},provider_message_id.eq.${m.replyTo}`).limit(1).maybeSingle();
        if (quoted?.body_text) {
          const q = String(quoted.body_text).replace(/\s+/g, ' ').slice(0, 120);
          bodyText = m.isReaction ? `${m.text} to: "${q}"` : `↪ Replying to: "${q}"\n${m.text}`;
        }
      }
      const preview = bodyText.slice(0, 140);
      const bump = m.isReaction ? 0 : 1;
      let { data: conv } = await supabase.from('cs_conversations')
        .select('id, linked_order_id, auto_link_locked, unread_count')
        .eq('contact_id', contactRow!.id).eq('channel', 'whatsapp').neq('status', 'closed')
        .order('last_message_at', { ascending: false }).limit(1).maybeSingle();

      let conversationId: string;
      if (conv?.id) {
        conversationId = conv.id;
        await supabase.from('cs_conversations').update({
          status: 'open', last_message_at: now, last_message_preview: preview,
          unread_count: (conv.unread_count ?? 0) + bump,
        }).eq('id', conversationId);
      } else {
        const { data: created, error: cErr } = await supabase.from('cs_conversations').insert({
          channel: 'whatsapp', contact_id: contactRow!.id, status: 'open',
          last_message_at: now, last_message_preview: preview, unread_count: 1,
        }).select().single();
        if (cErr) throw cErr;
        conversationId = created.id;
        conv = { id: conversationId, linked_order_id: null, auto_link_locked: false, unread_count: 1 } as any;
      }

      // Customer media: copy the file into private storage so it stays openable.
      let attachments: any[] | undefined;
      if (m.attachment) {
        const pid = findPhoneNumberId(body);
        const withPid = { ...m.attachment, ...(pid ? { phone_number_id: pid } : {}) };
        const stored = await downloadWhatsAppMedia(supabase, conversationId, withPid);
        attachments = [stored
          ? { ...withPid, url: stored.url, path: stored.path, size: stored.size }
          : { ...withPid, url: m.attachment.url || '', download_failed: true }];
      }

      const { error: mErr } = await supabase.from('cs_messages').insert({
        conversation_id: conversationId, direction: 'in', body_text: bodyText,
        external_id: m.externalId, status: 'received',
        ...(attachments ? { attachments } : {}),
      });
      if (mErr) throw mErr;
      saved.push(conversationId);

      if (!conv!.auto_link_locked) {
        const link = await resolveOrderLink(supabase, { channel: 'whatsapp', handle, body: m.text });
        await supabase.from('cs_conversations').update({
          linked_order_id: link.linked_order_id ?? conv!.linked_order_id,
          suggested_order_ids: link.suggested_order_ids,
        }).eq('id', conversationId);
      }
    }

    return json({ ok: true, saved: saved.length, echoed, statuses: statusUpdated });
  } catch (e: any) {
    console.error('cs-inbound-whatsapp error:', e?.message);
    return json({ error: 'failed' }, 500);
  }
});
