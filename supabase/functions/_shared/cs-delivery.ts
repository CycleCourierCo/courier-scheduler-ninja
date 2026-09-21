// Maps Resend delivery events onto customer-service thread messages so the inbox
// can show sent / delivered / read ticks and flag bounces.

const RANK: Record<string, number> = {
  sent: 1,
  delivered: 2,
  opened: 3,
  clicked: 4,
};

const PROBLEM_EVENTS = new Set(["bounced", "complained", "failed"]);

/** Normalises a Resend event name into the status we store on the message. */
function statusFromEvent(eventType: string): string | null {
  switch (eventType) {
    case "sent":
    case "delivered":
    case "opened":
    case "clicked":
      return eventType;
    case "bounced":
    case "complained":
    case "failed":
    case "delivery_delayed":
      return eventType === "delivery_delayed" ? "delayed" : eventType;
    default:
      return null;
  }
}

export async function applyCsDeliveryEvent(
  supabase: any,
  opts: {
    csMessageId: string | null;
    providerMessageId: string | null;
    eventType: string;
    createdAt: string;
  },
): Promise<void> {
  const status = statusFromEvent(opts.eventType);
  if (!status) return;

  let query = supabase
    .from("cs_messages")
    .select("id, conversation_id, delivery_status, delivery_events");

  if (opts.csMessageId && /^[0-9a-f-]{36}$/i.test(opts.csMessageId)) {
    query = query.eq("id", opts.csMessageId);
  } else if (opts.providerMessageId) {
    query = query.eq("provider_message_id", opts.providerMessageId);
  } else {
    return;
  }

  const { data: msg } = await query.limit(1).maybeSingle();
  if (!msg?.id) return;

  const events = Array.isArray(msg.delivery_events) ? msg.delivery_events : [];
  const already = events.some(
    (e: any) => e?.type === status && e?.at === opts.createdAt,
  );
  if (already) return;

  const isProblem = PROBLEM_EVENTS.has(status);
  const current = msg.delivery_status as string | null;
  const currentIsProblem = current ? PROBLEM_EVENTS.has(current) : false;

  // Problems always win; otherwise only move the status forwards.
  let nextStatus = current;
  if (isProblem) nextStatus = status;
  else if (!currentIsProblem && (RANK[status] ?? 0) > (RANK[current ?? ""] ?? 0)) {
    nextStatus = status;
  }

  await supabase
    .from("cs_messages")
    .update({
      delivery_status: nextStatus,
      delivery_events: [...events, { type: status, at: opts.createdAt }].slice(-30),
    })
    .eq("id", msg.id);

  if (isProblem && msg.conversation_id) {
    await supabase
      .from("cs_conversations")
      .update({ has_delivery_problem: true })
      .eq("id", msg.conversation_id);
  }
}
