// Automatic customer-service emails: ticket received confirmation and ticket closed.
// Both are branded with the standard portal email shell and logged into the ticket thread.
import { Resend } from "https://esm.sh/resend@2.0.0";
import { emailShell, emailUI, htmlToPlainText } from "./emailLayout.ts";
import { trackResend } from "./integrationLog.ts";
import { buildThreadHeaders, threadSubject } from "./cs-thread.ts";

const FROM = "CCC - Cycle Courier Co. <support@mail.cyclecourierco.com>";
const REPLY_TO = "support@mail.cyclecourierco.com";

const esc = (s: string) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Automated senders we must never reply to, to avoid mail loops. */
export function isAutomatedSender(email: string): boolean {
  const e = (email || "").toLowerCase();
  if (!e.includes("@")) return true;
  if (e.endsWith("@mail.cyclecourierco.com")) return true;
  if (e.endsWith("@cyclecourierco.com")) return true;
  return /(^|[._-])(no-?reply|donotreply|do-not-reply|mailer-daemon|postmaster|bounce[sd]?|notifications?|automated)([._-]|@)/.test(e);
}

/** Plain-English reply-time wording from the queue target for this priority. */
function replyWindow(targetMinutes: number | null): string {
  if (!targetMinutes || targetMinutes < 5) return "as soon as we can";
  if (targetMinutes < 60) return `within ${targetMinutes} minutes`;
  if (targetMinutes < 1440) {
    const h = Math.round(targetMinutes / 60);
    return `within ${h} working hour${h === 1 ? "" : "s"}`;
  }
  const d = Math.round(targetMinutes / 1440);
  return `within ${d} working day${d === 1 ? "" : "s"}`;
}

async function sendAndLog(
  supabase: any,
  opts: {
    conversationId: string;
    to: string;
    subject: string;
    html: string;
    headers?: Record<string, string>;
    systemEvent?: string;
  },
): Promise<boolean> {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    console.error("cs-auto-email: RESEND_API_KEY missing");
    return false;
  }

  const text = htmlToPlainText(opts.html);
  // Pre-allocate the thread message id so delivery events can be matched back to it.
  const messageId = crypto.randomUUID();
  // Thread this email onto the existing ticket conversation.
  const thread = await buildThreadHeaders(supabase, opts.conversationId, messageId);
  let externalId: string | null = null;
  let status: "sent" | "failed" = "sent";
  let errorMsg: string | null = null;

  try {
    const resend = trackResend(new Resend(RESEND_API_KEY), "cs automatic email");
    const { data, error } = await resend.emails.send({
      from: FROM,
      reply_to: REPLY_TO,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      text,
      headers: { "Auto-Submitted": "auto-replied", ...thread.headers, ...(opts.headers || {}) },
      tags: [
        { name: "cs_conversation_id", value: opts.conversationId },
        { name: "cs_message_id", value: messageId },
      ],
    } as any);
    if (error) throw error;
    externalId = (data as any)?.id || null;
  } catch (e: any) {
    status = "failed";
    errorMsg = (e?.message || "resend failed").slice(0, 500);
    console.error("cs-auto-email send failed");
  }

  await supabase.from("cs_messages").insert({
    id: messageId,
    conversation_id: opts.conversationId,
    direction: "out",
    body_text: text,
    body_html: opts.html,
    external_id: externalId,
    provider_message_id: externalId,
    delivery_status: status === "sent" ? "sent" : "failed",
    status,
    error: errorMsg,
    is_automatic: true,
    system_event: opts.systemEvent ?? null,
    email_message_id: thread.emailMessageId,
    in_reply_to: thread.inReplyTo,
  });

  return status === "sent";
}

/**
 * Confirms a brand new ticket to the customer. Safe to call more than once —
 * it only sends when ack_sent_at is still empty and the sender is a real person.
 */
export async function sendTicketReceivedEmail(supabase: any, conversationId: string): Promise<void> {
  const { data: conv } = await supabase
    .from("cs_conversations")
    .select("id, channel, subject, ticket_ref, priority, queue_id, ack_sent_at, contact:cs_contacts(handle, display_name)")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conv || conv.channel !== "email" || conv.ack_sent_at) return;
  const to = conv.contact?.handle;
  if (!to || isAutomatedSender(to)) return;

  // Claim the send first so a webhook retry cannot double-send.
  const { data: claimed } = await supabase
    .from("cs_conversations")
    .update({ ack_sent_at: new Date().toISOString() })
    .eq("id", conversationId)
    .is("ack_sent_at", null)
    .select("id");
  if (!claimed?.length) return;

  let targetMinutes: number | null = null;
  if (conv.queue_id) {
    const { data: sla } = await supabase
      .from("cs_queue_slas")
      .select("target_minutes")
      .eq("queue_id", conv.queue_id)
      .eq("priority", conv.priority || "normal")
      .maybeSingle();
    targetMinutes = sla?.target_minutes ?? null;
  }

  const ref = conv.ticket_ref || "";
  const name = conv.contact?.display_name?.split(" ")[0] || "there";
  const subjectLine = conv.subject || "(no subject)";

  const body = [
    emailUI.heading("We've got your message"),
    emailUI.paragraph(`Hi ${esc(name)}, thanks for getting in touch. Your message is with our customer service team and we'll come back to you ${replyWindow(targetMinutes)}.`),
    emailUI.detailPanel([
      ...(ref ? [{ label: "Ticket", value: esc(ref), mono: true }] : []),
      { label: "Subject", value: esc(subjectLine) },
    ]),
    emailUI.paragraph("If you want to add anything, just reply to this email and it will be added to the same ticket."),
    emailUI.small("Please keep the ticket number in the subject line so your reply reaches the right person."),
  ].join("");

  const html = emailShell(body, {
    subject: ref ? `We've received your message [${ref}]` : "We've received your message",
    preheader: `Your ticket ${ref} is with our customer service team.`,
    eyebrow: "CUSTOMER SERVICE",
  });

  const ok = await sendAndLog(supabase, {
    conversationId,
    to,
    subject: threadSubject(conv),
    html,
    systemEvent: "ticket_acknowledged",
  });

  // Let a later attempt try again if the send itself failed.
  if (!ok) {
    await supabase.from("cs_conversations").update({ ack_sent_at: null }).eq("id", conversationId);
  }
}

/**
 * Tells the customer their ticket is closed. Only sends once per closure.
 */
export async function sendTicketClosedEmail(supabase: any, conversationId: string): Promise<void> {
  const { data: conv } = await supabase
    .from("cs_conversations")
    .select("id, channel, subject, ticket_ref, closed_at, closure_email_sent_at, contact:cs_contacts(handle, display_name)")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conv || conv.channel !== "email") return;
  const to = conv.contact?.handle;
  if (!to || isAutomatedSender(to)) return;

  // One email per closure, not per ticket: a ticket reopened and closed again must email again.
  const closedAt = conv.closed_at || new Date().toISOString();
  const claim = supabase
    .from("cs_conversations")
    .update({ closure_email_sent_at: new Date().toISOString() })
    .eq("id", conversationId);
  const { data: claimed } = await claim
    .or(`closure_email_sent_at.is.null,closure_email_sent_at.lt.${closedAt}`)
    .select("id");
  if (!claimed?.length) return;

  const ref = conv.ticket_ref || "";
  const name = conv.contact?.display_name?.split(" ")[0] || "there";
  const subjectLine = conv.subject || "(no subject)";

  const body = [
    emailUI.heading("Your ticket is now closed"),
    emailUI.paragraph(`Hi ${esc(name)}, we've closed this ticket as it looks like everything is sorted. Thanks for bearing with us.`),
    emailUI.detailPanel([
      ...(ref ? [{ label: "Ticket", value: esc(ref), mono: true }] : []),
      { label: "Subject", value: esc(subjectLine) },
    ]),
    emailUI.paragraph("If anything is still outstanding, reply to this email and the ticket will reopen for the same team."),
  ].join("");

  const html = emailShell(body, {
    subject: ref ? `Ticket closed [${ref}]` : "Ticket closed",
    preheader: `Ticket ${ref} has been closed. Reply to reopen it.`,
    eyebrow: "CUSTOMER SERVICE",
  });

  const ok = await sendAndLog(supabase, {
    conversationId,
    to,
    subject: threadSubject(conv),
    html,
    systemEvent: "ticket_closed",
  });

  if (!ok) {
    await supabase.from("cs_conversations").update({ closure_email_sent_at: null }).eq("id", conversationId);
  }
}
