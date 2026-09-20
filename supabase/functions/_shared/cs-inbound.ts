// Shared inbound-email ingestion for the customer service inbox.
// Used by cs-inbound-email (generic JSON) and cs-resend-inbound (Resend webhook).
import { resolveOrderLink } from "./cs-order-linker.ts";
import { sanitizeInboundHtml } from "./sanitizeHtml.ts";
import { sendTicketReceivedEmail } from "./cs-auto-email.ts";
import { stripQuotedHtml, stripQuotedText } from "./cs-quoted-reply.ts";

export interface InboundEmail {
  from: string;            // "Jane Doe <jane@x.com>"
  subject?: string;
  text?: string;
  html?: string;
  message_id?: string;     // RFC822 Message-ID
  in_reply_to?: string;
  attachments?: Array<{ url?: string; filename?: string; content_type?: string; size?: number }>;
}

export function parseEmailAddress(from: string): { email: string; name?: string } {
  const m = from.match(/<([^>]+)>/);
  if (m) {
    const name = from.split('<')[0].trim().replace(/"/g, '');
    return { email: m[1].toLowerCase().trim(), name: name || undefined };
  }
  return { email: from.toLowerCase().trim() };
}

/**
 * Creates/updates the CS contact, conversation and message for an inbound email.
 * Returns the conversation id. Throws on database failure.
 */
export async function ingestInboundEmail(
  supabase: any,
  body: InboundEmail,
): Promise<string> {
  const { email, name } = parseEmailAddress(body.from);

  const { data: contactRow, error: contactErr } = await supabase
    .from('cs_contacts')
    .upsert({ channel: 'email', handle: email, display_name: name ?? null }, { onConflict: 'channel,handle' })
    .select()
    .single();
  if (contactErr) throw contactErr;

  // Thread on In-Reply-To when we can match a prior message in this inbox.
  let conversationId: string | null = null;
  if (body.in_reply_to) {
    const { data: priorMsg } = await supabase
      .from('cs_messages')
      .select('conversation_id')
      .eq('email_message_id', body.in_reply_to)
      .limit(1).maybeSingle();
    if (priorMsg?.conversation_id) conversationId = priorMsg.conversation_id;
  }

  // Thread on the ticket reference we put in outgoing subjects.
  if (!conversationId) {
    const ref = (body.subject || '').match(/TCK-\d+/i)?.[0]?.toUpperCase();
    if (ref) {
      const { data: refConv } = await supabase
        .from('cs_conversations')
        .select('id')
        .eq('ticket_ref', ref)
        .limit(1).maybeSingle();
      if (refConv?.id) conversationId = refConv.id;
    }
  }

  // Fall back to the contact's most recent open conversation so replies that
  // drop the In-Reply-To header still land in the same thread.
  if (!conversationId) {
    const { data: openConv } = await supabase
      .from('cs_conversations')
      .select('id')
      .eq('channel', 'email')
      .eq('contact_id', contactRow!.id)
      .in('status', ['open', 'pending'])
      .order('last_message_at', { ascending: false })
      .limit(1).maybeSingle();
    if (openConv?.id) conversationId = openConv.id;
  }

  // Show only what the customer wrote in this reply, not our quoted email.
  const replyText = stripQuotedText(body.text);
  const replyHtml = stripQuotedHtml(body.html);
  const preview = (replyText || '').slice(0, 140);

  let isNewTicket = false;
  if (!conversationId) {
    const { data: newConv, error: convErr } = await supabase
      .from('cs_conversations')
      .insert({
        channel: 'email',
        contact_id: contactRow!.id,
        subject: body.subject || '(no subject)',
        status: 'open',
        last_message_at: new Date().toISOString(),
        last_message_preview: preview,
        unread_count: 1,
      })
      .select().single();
    if (convErr) throw convErr;
    conversationId = newConv.id;
    isNewTicket = true;
  } else {
    await supabase.from('cs_conversations').update({
      status: 'open',
      last_message_at: new Date().toISOString(),
      last_message_preview: preview,
      unread_count: 1,
    }).eq('id', conversationId);
  }

  await supabase.from('cs_messages').insert({
    conversation_id: conversationId,
    direction: 'in',
    body_text: replyText || null,
    body_html: sanitizeInboundHtml(replyHtml || undefined) || null,
    attachments: body.attachments || [],
    email_message_id: body.message_id || null,
    in_reply_to: body.in_reply_to || null,
    status: 'received',
  });

  // Resolve order link (unless an agent has locked it)
  const { data: conv } = await supabase
    .from('cs_conversations')
    .select('linked_order_id, auto_link_locked')
    .eq('id', conversationId).single();
  if (conv && !conv.auto_link_locked) {
    const link = await resolveOrderLink(supabase, {
      channel: 'email', handle: email, subject: body.subject, body: body.text,
    });
    await supabase.from('cs_conversations').update({
      linked_order_id: link.linked_order_id ?? conv.linked_order_id,
      suggested_order_ids: link.suggested_order_ids,
    }).eq('id', conversationId);
  }

  // Confirm brand new tickets to the customer. Never blocks the webhook response,
  // and never fails the ingest if the email cannot be sent.
  if (isNewTicket) {
    const ack = sendTicketReceivedEmail(supabase, conversationId!)
      .catch((e) => console.error('cs ack email failed:', e?.message));
    try {
      (globalThis as any).EdgeRuntime?.waitUntil
        ? (globalThis as any).EdgeRuntime.waitUntil(ack)
        : await ack;
    } catch {
      // ignore — acknowledgement is best effort
    }
  }

  return conversationId!;
}

/** True when an inbound message already exists with this Message-ID (webhook retry). */
export async function isDuplicateInbound(supabase: any, messageId?: string | null): Promise<boolean> {
  if (!messageId) return false;
  const { data } = await supabase
    .from('cs_messages')
    .select('id')
    .eq('email_message_id', messageId)
    .eq('direction', 'in')
    .limit(1).maybeSingle();
  return !!data?.id;
}
