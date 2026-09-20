import { supabase } from "@/integrations/supabase/client";
import type { CsConversation, CsMessage, CsConversationStatus, CsPriority } from "@/types/customerService";

const conv = () => (supabase as any).from('cs_conversations');
const msg = () => (supabase as any).from('cs_messages');

export interface FetchConversationsParams {
  status?: CsConversationStatus | 'all';
  channel?: 'email' | 'whatsapp' | 'all';
  assignedToMe?: boolean;
  unassigned?: boolean;
  search?: string;
  userId?: string;
  queueId?: string | 'all';
  priority?: CsPriority | 'all';
  sort?: 'recent' | 'due' | 'priority';
}

const PRIORITY_WEIGHT: Record<CsPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export const fetchConversations = async (params: FetchConversationsParams = {}): Promise<CsConversation[]> => {
  let q = conv()
    .select('*, contact:cs_contacts(*), queue:cs_queues(id, name, slug)')
    .order('last_message_at', { ascending: false })
    .limit(200);

  if (params.status && params.status !== 'all') q = q.eq('status', params.status);
  if (params.channel && params.channel !== 'all') q = q.eq('channel', params.channel);
  if (params.assignedToMe && params.userId) q = q.eq('assignee_id', params.userId);
  if (params.unassigned) q = q.is('assignee_id', null);
  if (params.queueId && params.queueId !== 'all') q = q.eq('queue_id', params.queueId);
  if (params.priority && params.priority !== 'all') q = q.eq('priority', params.priority);

  const { data, error } = await q;
  if (error) throw error;

  let rows = (data || []) as CsConversation[];
  if (params.search) {
    const s = params.search.toLowerCase();
    rows = rows.filter(r =>
      (r.subject || '').toLowerCase().includes(s) ||
      (r.ticket_ref || '').toLowerCase().includes(s) ||
      (r.last_message_preview || '').toLowerCase().includes(s) ||
      (r.contact?.handle || '').toLowerCase().includes(s) ||
      (r.contact?.display_name || '').toLowerCase().includes(s)
    );
  }

  if (params.sort === 'due') {
    // Tickets with a live reply deadline first, soonest deadline at the top.
    rows = [...rows].sort((a, b) => {
      const da = a.next_response_due_at ? new Date(a.next_response_due_at).getTime() : Infinity;
      const dbb = b.next_response_due_at ? new Date(b.next_response_due_at).getTime() : Infinity;
      if (da !== dbb) return da - dbb;
      return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
    });
  } else if (params.sort === 'priority') {
    rows = [...rows].sort((a, b) => {
      const pa = PRIORITY_WEIGHT[a.priority] ?? 2;
      const pb = PRIORITY_WEIGHT[b.priority] ?? 2;
      if (pa !== pb) return pa - pb;
      return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
    });
  }

  return rows;
};

export const fetchConversation = async (id: string): Promise<CsConversation> => {
  const { data, error } = await conv()
    .select('*, contact:cs_contacts(*), queue:cs_queues(id, name, slug)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as CsConversation;
};

/** Counts per queue for the queue selector: total open plus how many are overdue. */
export const fetchQueueCounts = async (): Promise<Record<string, { open: number; overdue: number; unread: number }>> => {
  const { data, error } = await conv()
    .select('queue_id, status, unread_count, next_response_due_at')
    .in('status', ['open', 'pending'])
    .limit(2000);
  if (error) throw error;

  const now = Date.now();
  const out: Record<string, { open: number; overdue: number; unread: number }> = {};
  for (const row of (data || []) as any[]) {
    const key = row.queue_id || 'none';
    out[key] = out[key] || { open: 0, overdue: 0, unread: 0 };
    out[key].open += 1;
    if (row.unread_count > 0) out[key].unread += 1;
    if (row.next_response_due_at && new Date(row.next_response_due_at).getTime() < now) out[key].overdue += 1;
  }
  return out;
};

export const fetchMessages = async (conversationId: string): Promise<CsMessage[]> => {
  const { data, error } = await msg()
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as CsMessage[];
};

export const markConversationRead = async (id: string) => {
  const { error } = await conv().update({ unread_count: 0 }).eq('id', id);
  if (error) throw error;
};

export const updateConversation = async (id: string, patch: Partial<CsConversation>) => {
  const { error } = await conv().update(patch).eq('id', id);
  if (error) throw error;
};

/** Closes a ticket and emails the customer to confirm it has been dealt with. */
export const closeTicket = async (conversationId: string, notify = true) => {
  const { data, error } = await supabase.functions.invoke('cs-close-ticket', {
    body: { conversation_id: conversationId, notify },
  });
  if (error) throw error;
  return data;
};

export const addNote = async (conversationId: string, body: string, authorId: string) => {
  const { error } = await msg().insert({
    conversation_id: conversationId,
    direction: 'note',
    author_id: authorId,
    body_text: body,
    status: 'sent',
  });
  if (error) throw error;
};

export interface SendMessagePayload {
  conversationId: string;
  bodyText: string;
  bodyHtml?: string;
  template?: { name: string; params?: Record<string, string> };
}

export const sendMessage = async (payload: SendMessagePayload) => {
  const { data, error } = await supabase.functions.invoke('cs-send-message', {
    body: {
      conversation_id: payload.conversationId,
      body_text: payload.bodyText,
      body_html: payload.bodyHtml,
      template: payload.template,
    },
  });
  if (error) throw error;
  return data;
};

export const searchOrdersForLink = async (term: string) => {
  const t = term.trim();
  if (!t) return [];
  const { data, error } = await supabase
    .from('orders')
    .select('id, tracking_number, customer_order_number, sender, receiver, status, created_at')
    .or(`tracking_number.ilike.%${t}%,customer_order_number.ilike.%${t}%`)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data || [];
};

export const fetchOrdersByIds = async (ids: string[]) => {
  if (!ids?.length) return [];
  const { data, error } = await supabase
    .from('orders')
    .select('id, tracking_number, customer_order_number, sender, receiver, status, created_at')
    .in('id', ids);
  if (error) throw error;
  return data || [];
};

/** Pulls any inbound emails Resend failed to push to the webhook. */
export const syncInboundEmails = async (emailId?: string) => {
  const { data, error } = await supabase.functions.invoke('cs-resend-fetch', {
    body: emailId ? { email_id: emailId } : {},
  });
  if (error) throw error;
  return data as { checked: number; imported: number; duplicates: number };
};
