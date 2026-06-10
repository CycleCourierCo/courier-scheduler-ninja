import { supabase } from "@/integrations/supabase/client";
import type { CsConversation, CsMessage, CsConversationStatus } from "@/types/customerService";

const conv = () => (supabase as any).from('cs_conversations');
const msg = () => (supabase as any).from('cs_messages');

export interface FetchConversationsParams {
  status?: CsConversationStatus | 'all';
  channel?: 'email' | 'whatsapp' | 'all';
  assignedToMe?: boolean;
  unassigned?: boolean;
  search?: string;
  userId?: string;
}

export const fetchConversations = async (params: FetchConversationsParams = {}): Promise<CsConversation[]> => {
  let q = conv()
    .select('*, contact:cs_contacts(*)')
    .order('last_message_at', { ascending: false })
    .limit(200);

  if (params.status && params.status !== 'all') q = q.eq('status', params.status);
  if (params.channel && params.channel !== 'all') q = q.eq('channel', params.channel);
  if (params.assignedToMe && params.userId) q = q.eq('assignee_id', params.userId);
  if (params.unassigned) q = q.is('assignee_id', null);

  const { data, error } = await q;
  if (error) throw error;

  let rows = (data || []) as CsConversation[];
  if (params.search) {
    const s = params.search.toLowerCase();
    rows = rows.filter(r =>
      (r.subject || '').toLowerCase().includes(s) ||
      (r.last_message_preview || '').toLowerCase().includes(s) ||
      (r.contact?.handle || '').toLowerCase().includes(s) ||
      (r.contact?.display_name || '').toLowerCase().includes(s)
    );
  }
  return rows;
};

export const fetchConversation = async (id: string): Promise<CsConversation> => {
  const { data, error } = await conv().select('*, contact:cs_contacts(*)').eq('id', id).single();
  if (error) throw error;
  return data as CsConversation;
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
