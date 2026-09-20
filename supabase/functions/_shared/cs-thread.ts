// Shared email threading helpers for customer-service tickets.
// Every outbound email (staff reply, acknowledgement, closure) must carry
// Message-ID / In-Reply-To / References so the customer's mail client keeps
// the whole ticket in a single conversation.

const MAIL_DOMAIN = "mail.cyclecourierco.com";

/** The Message-ID we mint for one of our own outbound thread messages. */
export function mintMessageId(messageId: string): string {
  return `<cs-${messageId}@${MAIL_DOMAIN}>`;
}

export interface ThreadHeaders {
  headers: Record<string, string>;
  /** Value to persist in cs_messages.email_message_id for the new message. */
  emailMessageId: string;
  /** Value to persist in cs_messages.in_reply_to for the new message. */
  inReplyTo: string | null;
}

/**
 * Builds RFC 5322 threading headers for a new outbound message on a ticket.
 * Uses every message id already recorded on the conversation (inbound and
 * outbound) so consecutive outbound emails still chain correctly.
 */
export async function buildThreadHeaders(
  supabase: any,
  conversationId: string,
  newMessageId: string,
): Promise<ThreadHeaders> {
  const emailMessageId = mintMessageId(newMessageId);
  const headers: Record<string, string> = { "Message-ID": emailMessageId };

  let ids: string[] = [];
  try {
    const { data } = await supabase
      .from("cs_messages")
      .select("email_message_id, created_at")
      .eq("conversation_id", conversationId)
      .not("email_message_id", "is", null)
      .order("created_at", { ascending: true });
    ids = (data || [])
      .map((r: any) => String(r.email_message_id || "").trim())
      .filter((v: string) => v.length > 0 && v !== emailMessageId);
  } catch {
    ids = [];
  }

  // De-duplicate while keeping order.
  ids = ids.filter((v, i) => ids.indexOf(v) === i);

  const inReplyTo = ids.length ? ids[ids.length - 1] : null;
  if (inReplyTo) headers["In-Reply-To"] = inReplyTo;

  if (ids.length) {
    // Keep headers short: first message plus the most recent ten.
    const trimmed = ids.length > 11 ? [ids[0], ...ids.slice(-10)] : ids;
    headers["References"] = trimmed.join(" ");
  }

  return { headers, emailMessageId, inReplyTo };
}

/**
 * One consistent subject per ticket so subject-grouping mail clients also keep
 * the thread together. Never duplicates "Re:" or the ticket reference.
 */
export function threadSubject(conv: { subject?: string | null; ticket_ref?: string | null }): string {
  const raw = (conv.subject || "(no subject)").trim();
  const ref = (conv.ticket_ref || "").trim();
  let subject = /^re:/i.test(raw) ? raw : `Re: ${raw}`;
  if (ref && !subject.includes(ref)) subject = `${subject} [${ref}]`;
  return subject;
}
