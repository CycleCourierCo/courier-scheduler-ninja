// Outbound message sender — handles email (Resend) and WhatsApp (SendZen)
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.41.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // Verify user JWT and that they are admin or cs_agent
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders });
    }
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders });
    }
    const userId = userData.user.id;

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: roleRows } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    const roles = (roleRows || []).map((r: any) => r.role);
    if (!roles.includes('admin') && !roles.includes('cs_agent')) {
      return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: corsHeaders });
    }

    const body = await req.json();
    const { conversation_id, body_text, body_html, template } = body || {};
    if (!conversation_id || (!body_text && !template)) {
      return new Response(JSON.stringify({ error: 'conversation_id + body_text required' }), { status: 400, headers: corsHeaders });
    }

    const { data: conv, error: convErr } = await admin
      .from('cs_conversations')
      .select('*, contact:cs_contacts(*)')
      .eq('id', conversation_id).single();
    if (convErr || !conv) {
      return new Response(JSON.stringify({ error: 'conversation not found' }), { status: 404, headers: corsHeaders });
    }

    let externalId: string | null = null;
    let status: 'sent' | 'failed' = 'sent';
    let errorMsg: string | null = null;

    if (conv.channel === 'email') {
      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
      if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY missing');
      const resend = new Resend(RESEND_API_KEY);

      // Build threading headers
      const { data: lastIn } = await admin
        .from('cs_messages')
        .select('email_message_id')
        .eq('conversation_id', conversation_id)
        .eq('direction', 'in')
        .order('created_at', { ascending: false })
        .limit(1).maybeSingle();

      const headers: Record<string, string> = {};
      if (lastIn?.email_message_id) {
        headers['In-Reply-To'] = lastIn.email_message_id;
        headers['References'] = lastIn.email_message_id;
      }

      const subject = conv.subject?.startsWith('Re:') ? conv.subject : `Re: ${conv.subject || '(no subject)'}`;
      const html = body_html || `<div style="font-family:Arial,sans-serif">${(body_text || '').replace(/\n/g, '<br>')}</div>`;
      try {
        const { data: sent, error } = await resend.emails.send({
          from: 'The Cycle Courier Co. <Info@notification.cyclecourierco.com>',
          reply_to: 'Info@cyclecourierco.com',
          to: [conv.contact.handle],
          subject,
          html,
          text: body_text,
          headers,
        } as any);
        if (error) throw error;
        externalId = (sent as any)?.id || null;
      } catch (e: any) {
        status = 'failed';
        errorMsg = e?.message || 'resend failed';
      }
    } else if (conv.channel === 'whatsapp') {
      const SENDZEN_API_KEY = Deno.env.get('SENDZEN_API_KEY');
      if (!SENDZEN_API_KEY) throw new Error('SENDZEN_API_KEY missing');
      const fromNumber = '441217980767';
      const phone = conv.contact.handle.replace(/[^\d]/g, '');

      const payload: any = template
        ? {
            to: phone, from: fromNumber, type: 'template',
            template: {
              name: template.name, lang_code: 'en_GB',
              components: template.params
                ? [{ type: 'body', parameters: Object.entries(template.params).map(([k, v]) => ({ type: 'text', text: String(v), parameter_name: k })) }]
                : [],
            },
          }
        : { to: phone, from: fromNumber, type: 'text', text: { body: body_text } };

      try {
        const res = await fetch('https://api.sendzen.io/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SENDZEN_API_KEY}` },
          body: JSON.stringify(payload),
        });
        const respText = await res.text();
        if (!res.ok) {
          status = 'failed';
          errorMsg = respText.slice(0, 500);
        } else {
          try { externalId = JSON.parse(respText)?.id || JSON.parse(respText)?.message_id || null; } catch { /* ignore */ }
        }
      } catch (e: any) {
        status = 'failed';
        errorMsg = e?.message || 'sendzen failed';
      }
    }

    // Insert outbound message
    await admin.from('cs_messages').insert({
      conversation_id,
      direction: 'out',
      author_id: userId,
      body_text: body_text || null,
      body_html: body_html || null,
      external_id: externalId,
      status,
      error: errorMsg,
    });

    if (status === 'sent') {
      await admin.from('cs_conversations').update({
        last_message_at: new Date().toISOString(),
        last_message_preview: (body_text || '').slice(0, 140),
        status: 'pending',
      }).eq('id', conversation_id);
    }

    return new Response(JSON.stringify({ ok: status === 'sent', status, error: errorMsg }), {
      status: status === 'sent' ? 200 : 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('cs-send-message error:', e?.message);
    return new Response(JSON.stringify({ error: e?.message || 'failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
