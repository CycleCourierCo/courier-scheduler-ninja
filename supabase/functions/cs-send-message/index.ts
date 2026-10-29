// Outbound message sender — handles email (Resend) and WhatsApp (SendZen)
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.41.0";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { trackResend, trackedFetch } from "../_shared/integrationLog.ts";
import { buildThreadHeaders, threadSubject } from "../_shared/cs-thread.ts";
import { waMediaKindFor, waMediaSizeError, waKindTakesCaption } from "../_shared/whatsappMedia.ts";

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
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey);
    // Only the server's own auto-reply (service role) may send without a person attached.
    const isService = !!serviceKey && authHeader.slice(7).trim() === serviceKey;
    let userId: string | null = null;
    if (!isService) {
      const userClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData?.user) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: corsHeaders });
      }
      userId = userData.user.id;
      const { data: roleRows } = await admin.from('user_roles').select('role').eq('user_id', userId);
      const roles = (roleRows || []).map((r: any) => r.role);
      if (!roles.includes('admin') && !roles.includes('cs_agent')) {
        return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: corsHeaders });
      }
    }

    const body = await req.json();
    const automatic = isService && body?.automatic === true;
    if (isService && !automatic) {
      return new Response(JSON.stringify({ error: 'automatic flag required' }), { status: 400, headers: corsHeaders });
    }
    const autoFields = automatic ? { is_automatic: true, sent_via: 'auto_reply' } : {};
    const { conversation_id, body_text, body_html, template } = body || {};
    const rawAttachments = Array.isArray(body?.attachments) ? body.attachments : [];
    if (!conversation_id || (!body_text && !template && rawAttachments.length === 0)) {
      return new Response(JSON.stringify({ error: 'conversation_id + body_text required' }), { status: 400, headers: corsHeaders });
    }
    if (rawAttachments.length > 10) {
      return new Response(JSON.stringify({ error: 'Up to 10 attachments allowed' }), { status: 400, headers: corsHeaders });
    }
    // Files are uploaded by staff into cs-attachments/<conversation_id>/...; sign them for the provider and the thread.
    const attachments: { url: string; filename: string; content_type: string; size: number; path: string }[] = [];
    for (const a of rawAttachments) {
      const path = String(a?.path || '');
      if (!path.startsWith(`${conversation_id}/`) || path.includes('..')) {
        return new Response(JSON.stringify({ error: 'invalid attachment' }), { status: 400, headers: corsHeaders });
      }
      const { data: signed, error: signErr } = await admin.storage.from('cs-attachments').createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signErr || !signed?.signedUrl) {
        return new Response(JSON.stringify({ error: 'attachment not found' }), { status: 400, headers: corsHeaders });
      }
      attachments.push({
        url: signed.signedUrl,
        path,
        filename: String(a?.filename || path.split('/').pop() || 'file').slice(0, 200),
        content_type: String(a?.content_type || 'application/octet-stream').slice(0, 100),
        size: Number(a?.size) || 0,
      });
    }

    const { data: conv, error: convErr } = await admin
      .from('cs_conversations')
      .select('*, contact:cs_contacts(*)')
      .eq('id', conversation_id).single();
    if (convErr || !conv) {
      return new Response(JSON.stringify({ error: 'conversation not found' }), { status: 404, headers: corsHeaders });
    }

    if (conv.status === 'closed') {
      return new Response(JSON.stringify({ error: 'ticket_closed' }), { status: 409, headers: corsHeaders });
    }

    let externalId: string | null = null;
    let status: 'sent' | 'failed' = 'sent';
    let errorMsg: string | null = null;
    // Pre-allocate the thread message id so Resend delivery events map back to it.
    const messageId = crypto.randomUUID();
    let emailMessageId: string | null = null;
    let emailInReplyTo: string | null = null;


    if (conv.channel === 'email') {
      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
      if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY missing');
      const resend = trackResend(new Resend(RESEND_API_KEY), "cs reply email");

      // Thread onto every message already on this ticket so the customer sees one conversation.
      const thread = await buildThreadHeaders(admin, conversation_id, messageId);
      const headers: Record<string, string> = { ...thread.headers };
      emailMessageId = thread.emailMessageId;
      emailInReplyTo = thread.inReplyTo;

      const subject = threadSubject(conv);
      const html = body_html || `<div style="font-family:Arial,sans-serif">${(body_text || '').replace(/\n/g, '<br>')}</div>`;
      try {
        // Send from the receiving subdomain so customer replies land back in this inbox.
        const { data: sent, error } = await resend.emails.send({
          from: "CCC - Cycle Courier Co. <support@mail.cyclecourierco.com>",
          reply_to: 'support@mail.cyclecourierco.com',
          to: [conv.contact.handle],
          subject,
          html,
          text: body_text || ' ',
          ...(attachments.length ? { attachments: attachments.map((a) => ({ filename: a.filename, path: a.url })) } : {}),
          headers,
          tags: [
            { name: 'cs_conversation_id', value: conversation_id },
            { name: 'cs_message_id', value: messageId },
          ],
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

      for (const a of attachments) {
        const err = waMediaSizeError(a.content_type, a.size);
        if (err) {
          return new Response(JSON.stringify({ error: `${a.filename}: ${err}` }), { status: 400, headers: corsHeaders });
        }
      }

      // Each WhatsApp send is its own message so every one gets its own delivery ticks.
      type Send = { payload: any; text: string | null; files: typeof attachments };
      const sends: Send[] = [];
      let caption = body_text ? String(body_text) : '';
      if (template) {
        sends.push({
          payload: {
            to: phone, from: fromNumber, type: 'template',
            template: {
              name: template.name, lang_code: 'en_GB',
              components: template.params
                ? [{ type: 'body', parameters: Object.entries(template.params).map(([k, v]) => ({ type: 'text', text: String(v), parameter_name: k })) }]
                : [],
            },
          },
          text: body_text || `[Template: ${template.name}]`, files: [],
        });
        caption = '';
      } else if (caption && (attachments.length === 0 || !waKindTakesCaption(waMediaKindFor(attachments[0].content_type)) || caption.length > 1024)) {
        sends.push({ payload: { to: phone, from: fromNumber, type: 'text', text: { body: caption, preview_url: true } }, text: caption, files: [] });
        caption = '';
      }
      attachments.forEach((a, i) => {
        const kind = waMediaKindFor(a.content_type);
        const media: any = { link: a.url };
        if (kind === 'document') media.filename = a.filename;
        const useCaption = i === 0 && caption && waKindTakesCaption(kind);
        if (useCaption) media.caption = caption;
        sends.push({ payload: { to: phone, from: fromNumber, type: kind, [kind]: media }, text: useCaption ? caption : null, files: [a] });
      });

      const rows: any[] = [];
      let anyFailed = false;
      for (const s of sends) {
        let rowStatus: 'sent' | 'failed' = 'sent';
        let rowErr: string | null = null;
        let rowExt: string | null = null;
        if (anyFailed) { rowStatus = 'failed'; rowErr = 'not sent: an earlier part failed'; }
        else {
          try {
            const res = await trackedFetch("whatsapp", "cs reply", 'https://api.sendzen.io/v1/messages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SENDZEN_API_KEY}` },
              body: JSON.stringify(s.payload),
            });
            const respText = await res.text();
            if (!res.ok) { rowStatus = 'failed'; rowErr = respText.slice(0, 500); }
            else {
              try {
                const j = JSON.parse(respText);
                rowExt = j?.messages?.[0]?.id || j?.data?.messages?.[0]?.id || j?.id || j?.message_id || j?.data?.id || null;
              } catch { /* ignore */ }
            }
          } catch (e: any) { rowStatus = 'failed'; rowErr = e?.message || 'sendzen failed'; }
        }
        if (rowStatus === 'failed') anyFailed = true;
        rows.push({
          id: rows.length === 0 ? messageId : crypto.randomUUID(),
          conversation_id, direction: 'out', author_id: userId, ...autoFields,
          body_text: s.text,
          attachments: s.files.map(({ url, filename, content_type, size, path }) => ({ url, filename, content_type, size, path })),
          external_id: rowExt, provider_message_id: rowExt,
          delivery_status: rowStatus === 'sent' ? 'sent' : 'failed',
          status: rowStatus, error: rowErr,
        });
      }
      status = anyFailed ? 'failed' : 'sent';
      errorMsg = rows.find((r) => r.error)?.error ?? null;
      await admin.from('cs_messages').insert(rows);
    }

    if (conv.channel !== 'whatsapp') {
      await admin.from('cs_messages').insert({
        id: messageId,
        conversation_id,
        direction: 'out',
        author_id: userId,
        ...autoFields,
        body_text: body_text || null,
        body_html: body_html || null,
        attachments: attachments.map(({ url, filename, content_type, size }) => ({ url, filename, content_type, size })),
        external_id: externalId,
        provider_message_id: externalId,
        delivery_status: status === 'sent' ? 'sent' : 'failed',
        status,
        error: errorMsg,
        email_message_id: emailMessageId,
        in_reply_to: emailInReplyTo,
      });
    }

    if (status === 'sent' && automatic) {
      // Auto-replies leave the ticket where it was so staff still see it.
      await admin.from('cs_conversations').update({
        last_message_at: new Date().toISOString(),
        last_message_preview: (body_text || '').slice(0, 140),
      }).eq('id', conversation_id);
    } else if (status === 'sent') {
      await admin.from('cs_conversations').update({
        last_message_at: new Date().toISOString(),
        last_message_preview: (body_text || (attachments.length ? `📎 ${attachments.map((a) => a.filename).join(', ')}` : '')).slice(0, 140),
        status: 'pending',
        // Replying reopens a closed ticket, so the next close emails the customer again.
        closed_at: null,
        closure_email_sent_at: null,
      }).eq('id', conversation_id);

      // A human has answered, so the automatic confirmation is no longer wanted.
      await admin.from('cs_conversations')
        .update({ ack_sent_at: new Date().toISOString() })
        .eq('id', conversation_id)
        .is('ack_sent_at', null);
    }

    return new Response(JSON.stringify({ ok: status === 'sent', status, error: errorMsg, message_id: messageId }), {
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
