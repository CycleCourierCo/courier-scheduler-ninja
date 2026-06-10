// Inbound email webhook (e.g. Resend inbound). Creates CS contact/conversation/message.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.41.0";
import { resolveOrderLink } from "../_shared/cs-order-linker.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface InboundEmail {
  from: string;            // "Jane Doe <jane@x.com>"
  subject?: string;
  text?: string;
  html?: string;
  message_id?: string;     // RFC822 Message-ID
  in_reply_to?: string;
  attachments?: Array<{ url?: string; filename?: string; content_type?: string; size?: number }>;
}

function parseEmail(from: string): { email: string; name?: string } {
  const m = from.match(/<([^>]+)>/);
  if (m) {
    const name = from.split('<')[0].trim().replace(/"/g, '');
    return { email: m[1].toLowerCase().trim(), name: name || undefined };
  }
  return { email: from.toLowerCase().trim() };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json() as InboundEmail;
    if (!body?.from) {
      return new Response(JSON.stringify({ error: 'from required' }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { email, name } = parseEmail(body.from);

    // Upsert contact
    const { data: contactRow, error: contactErr } = await supabase
      .from('cs_contacts')
      .upsert({ channel: 'email', handle: email, display_name: name ?? null }, { onConflict: 'channel,handle' })
      .select()
      .single();
    if (contactErr) throw contactErr;

    // Thread: find existing message by in_reply_to
    let conversationId: string | null = null;
    if (body.in_reply_to) {
      const { data: priorMsg } = await supabase
        .from('cs_messages')
        .select('conversation_id')
        .eq('email_message_id', body.in_reply_to)
        .limit(1).maybeSingle();
      if (priorMsg?.conversation_id) conversationId = priorMsg.conversation_id;
    }

    if (!conversationId) {
      const { data: newConv, error: convErr } = await supabase
        .from('cs_conversations')
        .insert({
          channel: 'email',
          contact_id: contactRow!.id,
          subject: body.subject || '(no subject)',
          status: 'open',
          last_message_at: new Date().toISOString(),
          last_message_preview: (body.text || '').slice(0, 140),
          unread_count: 1,
        })
        .select().single();
      if (convErr) throw convErr;
      conversationId = newConv.id;
    } else {
      await supabase.from('cs_conversations').update({
        status: 'open',
        last_message_at: new Date().toISOString(),
        last_message_preview: (body.text || '').slice(0, 140),
        unread_count: 1,
      }).eq('id', conversationId);
    }

    // Insert message
    await supabase.from('cs_messages').insert({
      conversation_id: conversationId,
      direction: 'in',
      body_text: body.text || null,
      body_html: body.html || null,
      attachments: body.attachments || [],
      email_message_id: body.message_id || null,
      in_reply_to: body.in_reply_to || null,
      status: 'received',
    });

    // Resolve order link (unless locked)
    const { data: conv } = await supabase.from('cs_conversations').select('linked_order_id, auto_link_locked').eq('id', conversationId).single();
    if (conv && !conv.auto_link_locked) {
      const link = await resolveOrderLink(supabase, {
        channel: 'email', handle: email, subject: body.subject, body: body.text,
      });
      await supabase.from('cs_conversations').update({
        linked_order_id: link.linked_order_id ?? conv.linked_order_id,
        suggested_order_ids: link.suggested_order_ids,
      }).eq('id', conversationId);
    }

    return new Response(JSON.stringify({ ok: true, conversation_id: conversationId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('cs-inbound-email error:', e?.message);
    return new Response(JSON.stringify({ error: e?.message || 'failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
