// Inbound WhatsApp webhook (e.g. SendZen). Creates CS contact/conversation/message.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.41.0";
import { resolveOrderLink } from "../_shared/cs-order-linker.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sendzen-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // Optional shared-secret check
    const expected = Deno.env.get('SENDZEN_INBOUND_SECRET');
    if (expected) {
      const got = req.headers.get('x-sendzen-signature') || req.headers.get('authorization')?.replace('Bearer ', '');
      if (got !== expected) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders });
      }
    }

    const body = await req.json();
    // SendZen webhook payload — tolerate multiple shapes
    const from = body.from || body.sender || body.wa_id || body.message?.from || '';
    const text = body.text || body.body || body.message?.text?.body || body.message?.text || '';
    const externalId = body.message_id || body.id || body.message?.id || null;
    const senderName = body.profile_name || body.contact?.profile?.name || body.from_name;

    if (!from || !text) {
      return new Response(JSON.stringify({ error: 'from + text required' }), { status: 400, headers: corsHeaders });
    }

    const handle = String(from).replace(/[^\d+]/g, '').replace(/^00/, '+');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: contactRow, error: contactErr } = await supabase
      .from('cs_contacts')
      .upsert({ channel: 'whatsapp', handle, display_name: senderName || null }, { onConflict: 'channel,handle' })
      .select().single();
    if (contactErr) throw contactErr;

    // WhatsApp: one rolling conversation per contact (latest open or new)
    let { data: conv } = await supabase
      .from('cs_conversations')
      .select('id, linked_order_id, auto_link_locked')
      .eq('contact_id', contactRow!.id)
      .eq('channel', 'whatsapp')
      .neq('status', 'closed')
      .order('last_message_at', { ascending: false })
      .limit(1).maybeSingle();

    let conversationId: string;
    if (conv?.id) {
      conversationId = conv.id;
      await supabase.from('cs_conversations').update({
        status: 'open',
        last_message_at: new Date().toISOString(),
        last_message_preview: String(text).slice(0, 140),
        unread_count: 1,
      }).eq('id', conversationId);
    } else {
      const { data: created, error: cErr } = await supabase
        .from('cs_conversations')
        .insert({
          channel: 'whatsapp',
          contact_id: contactRow!.id,
          status: 'open',
          last_message_at: new Date().toISOString(),
          last_message_preview: String(text).slice(0, 140),
          unread_count: 1,
        }).select().single();
      if (cErr) throw cErr;
      conversationId = created.id;
      conv = { id: conversationId, linked_order_id: null, auto_link_locked: false } as any;
    }

    await supabase.from('cs_messages').insert({
      conversation_id: conversationId,
      direction: 'in',
      body_text: String(text),
      external_id: externalId,
      status: 'received',
    });

    if (!conv!.auto_link_locked) {
      const link = await resolveOrderLink(supabase, {
        channel: 'whatsapp', handle, body: String(text),
      });
      await supabase.from('cs_conversations').update({
        linked_order_id: link.linked_order_id ?? conv!.linked_order_id,
        suggested_order_ids: link.suggested_order_ids,
      }).eq('id', conversationId);
    }

    return new Response(JSON.stringify({ ok: true, conversation_id: conversationId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('cs-inbound-whatsapp error:', e?.message);
    return new Response(JSON.stringify({ error: e?.message || 'failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
