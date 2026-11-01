// Closes a customer service ticket and emails the customer to confirm.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.41.0";
import { sendTicketClosedEmail } from "../_shared/cs-auto-email.ts";
import { inWhatsAppWindow, whatsappClosingText } from "../_shared/csTicketRules.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: 'unauthorized' }, 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: roleRows } = await admin
      .from('user_roles').select('role').eq('user_id', userData.user.id);
    const roles = (roleRows || []).map((r: any) => r.role);
    if (!roles.includes('admin') && !roles.includes('cs_agent')) return json({ error: 'forbidden' }, 403);

    const body = await req.json().catch(() => ({}));
    const conversationId = typeof body?.conversation_id === 'string' ? body.conversation_id : '';
    const notify = body?.notify !== false;
    if (!/^[0-9a-f-]{36}$/i.test(conversationId)) return json({ error: 'conversation_id required' }, 400);

    const { data: conv, error: convErr } = await admin
      .from('cs_conversations')
      .select('id, status, channel, ticket_ref, contact:cs_contacts(handle)')
      .eq('id', conversationId)
      .maybeSingle();
    if (convErr) throw convErr;
    if (!conv) return json({ error: 'conversation not found' }, 404);
    if (conv.status === 'closed') return json({ ok: true, already_closed: true });

    const { error: updErr } = await admin
      .from('cs_conversations')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        first_response_due_at: null,
        next_response_due_at: null,
        snooze_until: null,
      })
      .eq('id', conversationId);
    if (updErr) throw updErr;

    // A closed ticket should never receive the "we've got your message" email afterwards.
    await admin.from('cs_conversations')
      .update({ ack_sent_at: new Date().toISOString() })
      .eq('id', conversationId)
      .is('ack_sent_at', null);

    let notified: 'email' | 'whatsapp' | null = null;
    let notNotifiedReason: string | null = null;
    if (notify && conv.channel === 'email') {
      await sendTicketClosedEmail(admin, conversationId);
      notified = 'email';
    } else if (notify && conv.channel === 'whatsapp') {
      const { data: lastIn } = await admin.from('cs_messages').select('created_at')
        .eq('conversation_id', conversationId).eq('direction', 'in')
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      const handle = (conv as any).contact?.handle as string | undefined;
      const key = Deno.env.get('SENDZEN_API_KEY');
      if (!inWhatsAppWindow(lastIn?.created_at)) notNotifiedReason = 'outside the 24-hour WhatsApp window';
      else if (!handle || !key) notNotifiedReason = 'WhatsApp not configured';
      else {
        const text = whatsappClosingText(conv.ticket_ref);
        let ext: string | null = null; let err: string | null = null;
        try {
          const res = await fetch('https://api.sendzen.io/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
            body: JSON.stringify({ to: handle.replace(/[^\d]/g, ''), from: '441217980767', type: 'text', text: { body: text } }),
          });
          const t = await res.text();
          if (!res.ok) err = `SendZen ${res.status}`;
          else { try { const j = JSON.parse(t); ext = j?.messages?.[0]?.id || j?.data?.messages?.[0]?.id || j?.id || null; } catch { /* ignore */ } }
        } catch { err = 'send failed'; }
        await admin.from('cs_messages').insert({
          conversation_id: conversationId, direction: 'out', author_id: userData.user.id, body_text: text,
          external_id: ext, provider_message_id: ext, is_automatic: true,
          status: err ? 'failed' : 'sent', delivery_status: err ? 'failed' : 'sent', error: err,
        });
        if (err) notNotifiedReason = 'WhatsApp send failed'; else notified = 'whatsapp';
      }
    }

    return json({ ok: true, notified, reason: notNotifiedReason });
  } catch (e: any) {
    console.error('cs-close-ticket error:', e?.message);
    return json({ error: e?.message || 'failed' }, 500);
  }
});
