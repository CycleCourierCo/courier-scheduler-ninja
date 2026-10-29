// Pure calculations for Customer Service analytics (no imports so Vitest tests the same rules the page uses).

export interface CsConv {
  id: string; channel: string; status: string; priority: string; queue_id: string | null;
  assignee_id: string | null; created_at: string; closed_at: string | null;
  first_response_due_at: string | null; linked_order_id: string | null; subject: string | null;
}
export interface CsMsg {
  conversation_id: string; direction: string; author_id: string | null; created_at: string;
  is_automatic: boolean; system_event: string | null; delivery_status: string | null;
  sent_via: string | null; body_text: string | null; status: string;
}

/** Enquiry topics, matched in order against the subject + first customer message. */
export const TOPICS: { key: string; label: string; words: RegExp }[] = [
  { key: 'damage', label: 'Damage / claims', words: /\b(damage[sd]?|broken|scratch\w*|claim|bent|crack\w*|dent\w*)\b/i },
  { key: 'tracking', label: 'Where is my bike', words: /\b(where|track\w*|eta|update|status|arriv\w*|still waiting|not (yet )?(arrived|received))\b/i },
  { key: 'collection', label: 'Collection', words: /\b(collect\w*|pick ?up|pickup)\b/i },
  { key: 'delivery', label: 'Delivery', words: /\b(deliver\w*|drop ?off|receiv\w*)\b/i },
  { key: 'reschedule', label: 'Dates / rescheduling', words: /\b(reschedul\w*|change (the )?date|another (day|date)|availability|timeslot|time slot|date)\b/i },
  { key: 'invoice', label: 'Invoices / payment', words: /\b(invoice\w*|pay\w*|refund\w*|charge\w*|bill\w*|receipt|price|cost)\b/i },
  { key: 'quote', label: 'Quotes / new booking', words: /\b(quote\w*|book\w*|how much|send a bike|new order)\b/i },
  { key: 'workshop', label: 'Repairs / inspection', words: /\b(repair\w*|inspect\w*|service|mechanic|workshop|parts?)\b/i },
  { key: 'cancel', label: 'Cancellations', words: /\b(cancel\w*)\b/i },
];

export function classifyTopic(text: string): string {
  const t = text || '';
  for (const topic of TOPICS) if (topic.words.test(t)) return topic.key;
  return 'other';
}
export const topicLabel = (k: string) => TOPICS.find((t) => t.key === k)?.label ?? 'Other';

/** A staff reply counts only if a person sent it (not automatic, not a system event or note). */
export const isStaffReply = (m: CsMsg) =>
  m.direction === 'out' && !m.is_automatic && !m.system_event && !!m.author_id && m.status !== 'note';

export const FRT_BUCKETS = [
  { label: '< 15 min', max: 15 }, { label: '15–60 min', max: 60 }, { label: '1–4 hrs', max: 240 },
  { label: '4–24 hrs', max: 1440 }, { label: '> 24 hrs', max: Infinity },
];
export function frtBucket(mins: number) {
  return FRT_BUCKETS.findIndex((b) => mins < b.max);
}

export const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const mins = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 60000;

export interface ConvStats {
  conv: CsConv; topic: string; firstResponseMins: number | null; firstResponder: string | null;
  resolutionMins: number | null; slaMet: boolean | null; inbound: number; staffReplies: number;
  reopened: boolean;
}

export function analyseConversation(conv: CsConv, msgs: CsMsg[]): ConvStats {
  const sorted = [...msgs].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const firstIn = sorted.find((m) => m.direction === 'in');
  const firstReply = sorted.find((m) => isStaffReply(m) && (!firstIn || m.created_at >= firstIn.created_at));
  const start = firstIn?.created_at ?? conv.created_at;
  const frt = firstIn && firstReply ? Math.max(0, mins(start, firstReply.created_at)) : null;
  const closes = sorted.filter((m) => m.system_event === 'ticket_closed');
  const reopened = closes.length > 0 && sorted.some((m) => m.direction === 'in' && m.created_at > closes[0].created_at);
  let slaMet: boolean | null = null;
  if (conv.first_response_due_at && firstIn) {
    slaMet = firstReply ? firstReply.created_at <= conv.first_response_due_at
      : new Date(conv.first_response_due_at).getTime() > Date.now() ? null : false;
  }
  return {
    conv,
    topic: classifyTopic(`${conv.subject ?? ''} ${firstIn?.body_text ?? ''}`),
    firstResponseMins: frt,
    firstResponder: firstReply?.author_id ?? null,
    resolutionMins: conv.status === 'closed' && conv.closed_at ? Math.max(0, mins(conv.created_at, conv.closed_at)) : null,
    slaMet,
    inbound: sorted.filter((m) => m.direction === 'in').length,
    staffReplies: sorted.filter(isStaffReply).length,
    reopened,
  };
}

export interface AgentRow {
  id: string; replies: number; whatsapp: number; email: number; firstResponses: number;
  medianFrt: number | null; closed: number; assigned: number;
}

export function buildReport(convs: CsConv[], msgs: CsMsg[]) {
  const byConv = new Map<string, CsMsg[]>();
  for (const m of msgs) (byConv.get(m.conversation_id) ?? byConv.set(m.conversation_id, []).get(m.conversation_id)!).push(m);
  const stats = convs.map((c) => analyseConversation(c, byConv.get(c.id) ?? []));
  const frts = stats.map((s) => s.firstResponseMins).filter((x): x is number => x != null);
  const res = stats.map((s) => s.resolutionMins).filter((x): x is number => x != null);
  const slaKnown = stats.filter((s) => s.slaMet != null);

  // Agents
  const convChannel = new Map(convs.map((c) => [c.id, c.channel]));
  const agents = new Map<string, AgentRow & { frts: number[] }>();
  const agent = (id: string) => agents.get(id) ?? agents.set(id, { id, replies: 0, whatsapp: 0, email: 0, firstResponses: 0, medianFrt: null, closed: 0, assigned: 0, frts: [] }).get(id)!;
  for (const m of msgs) {
    if (!isStaffReply(m) || !convChannel.has(m.conversation_id)) continue;
    const a = agent(m.author_id!); a.replies++;
    if (convChannel.get(m.conversation_id) === 'whatsapp') a.whatsapp++; else a.email++;
  }
  for (const s of stats) {
    if (s.firstResponder && s.firstResponseMins != null) { const a = agent(s.firstResponder); a.firstResponses++; a.frts.push(s.firstResponseMins); }
    if (s.conv.assignee_id) { const a = agent(s.conv.assignee_id); a.assigned++; if (s.conv.status === 'closed') a.closed++; }
  }
  const agentRows: AgentRow[] = [...agents.values()].map(({ frts: f, ...r }) => ({ ...r, medianFrt: median(f) }))
    .sort((a, b) => b.replies - a.replies);

  // Topics
  const topicMap = new Map<string, ConvStats[]>();
  for (const s of stats) (topicMap.get(s.topic) ?? topicMap.set(s.topic, []).get(s.topic)!).push(s);
  const topics = [...topicMap.entries()].map(([key, list]) => ({
    key, label: topicLabel(key), count: list.length,
    whatsapp: list.filter((s) => s.conv.channel === 'whatsapp').length,
    email: list.filter((s) => s.conv.channel !== 'whatsapp').length,
    medianFrt: median(list.map((s) => s.firstResponseMins).filter((x): x is number => x != null)),
    medianResolution: median(list.map((s) => s.resolutionMins).filter((x): x is number => x != null)),
    open: list.filter((s) => s.conv.status !== 'closed').length,
  })).sort((a, b) => b.count - a.count);

  // Heatmap (Europe/London) day x hour from first inbound messages
  const heat = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'short', hour: '2-digit', hourCycle: 'h23' });
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  for (const m of msgs) {
    if (m.direction !== 'in') continue;
    const parts = fmt.formatToParts(new Date(m.created_at));
    const d = DAYS.indexOf(parts.find((p) => p.type === 'weekday')?.value ?? '');
    const h = Number(parts.find((p) => p.type === 'hour')?.value);
    if (d >= 0 && h >= 0 && h < 24) heat[d][h]++;
  }

  // Delivery health of outbound messages
  const outbound = msgs.filter((m) => m.direction === 'out' && !m.system_event && m.status !== 'note');
  const delivery = { sent: 0, delivered: 0, read: 0, failed: 0, unknown: 0 };
  for (const m of outbound) {
    const s = (m.delivery_status || (m.status === 'failed' ? 'failed' : '')) as keyof typeof delivery;
    if (s in delivery) delivery[s]++; else delivery.unknown++;
  }

  const now = Date.now();
  const backlog = [
    { label: '< 1 day', max: 1 }, { label: '1–3 days', max: 3 }, { label: '3–7 days', max: 7 }, { label: '> 7 days', max: Infinity },
  ].map((b) => ({ ...b, count: 0 }));
  for (const c of convs) if (c.status !== 'closed') {
    const days = (now - new Date(c.created_at).getTime()) / 86400000;
    backlog.find((b) => days < b.max)!.count++;
  }

  return {
    stats,
    totals: {
      tickets: convs.length,
      whatsapp: convs.filter((c) => c.channel === 'whatsapp').length,
      email: convs.filter((c) => c.channel !== 'whatsapp').length,
      open: convs.filter((c) => c.status === 'open').length,
      pending: convs.filter((c) => c.status === 'pending').length,
      closed: convs.filter((c) => c.status === 'closed').length,
      awaitingFirstReply: stats.filter((s) => s.inbound > 0 && s.firstResponseMins == null && s.conv.status !== 'closed').length,
      inboundMessages: msgs.filter((m) => m.direction === 'in').length,
      staffReplies: msgs.filter(isStaffReply).length,
      automated: msgs.filter((m) => m.direction === 'out' && m.is_automatic).length,
      medianFrt: median(frts), avgFrt: avg(frts),
      medianResolution: median(res), avgResolution: avg(res),
      slaRate: slaKnown.length ? slaKnown.filter((s) => s.slaMet).length / slaKnown.length : null,
      linkedRate: convs.length ? convs.filter((c) => c.linked_order_id).length / convs.length : null,
      reopenRate: stats.filter((s) => s.conv.closed_at || s.reopened).length
        ? stats.filter((s) => s.reopened).length / stats.filter((s) => s.conv.closed_at || s.reopened).length : null,
      repliesPerTicket: avg(stats.filter((s) => s.staffReplies > 0).map((s) => s.staffReplies)),
    },
    frtBuckets: FRT_BUCKETS.map((b, i) => ({ label: b.label, count: frts.filter((f) => frtBucket(f) === i).length })),
    topics, agentRows, heat, days: DAYS, delivery, backlog,
    priorities: ['urgent', 'high', 'normal', 'low'].map((p) => ({ priority: p, count: convs.filter((c) => c.priority === p).length })),
  };
}

export function formatMins(m: number | null | undefined) {
  if (m == null) return '—';
  if (m < 60) return `${Math.round(m)}m`;
  if (m < 1440) return `${(m / 60).toFixed(1)}h`;
  return `${(m / 1440).toFixed(1)}d`;
}
