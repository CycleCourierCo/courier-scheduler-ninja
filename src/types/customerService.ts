export type CsChannel = 'email' | 'whatsapp';
export type CsConversationStatus = 'open' | 'pending' | 'snoozed' | 'closed';
export type CsMessageDirection = 'in' | 'out' | 'note';
export type CsMessageStatus = 'received' | 'sent' | 'failed' | 'delivered' | 'read';

export interface CsContact {
  id: string;
  channel: CsChannel;
  handle: string;
  display_name: string | null;
  linked_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CsConversation {
  id: string;
  channel: CsChannel;
  contact_id: string;
  subject: string | null;
  status: CsConversationStatus;
  assignee_id: string | null;
  last_message_at: string;
  last_message_preview: string | null;
  unread_count: number;
  snooze_until: string | null;
  linked_order_id: string | null;
  suggested_order_ids: string[];
  auto_link_locked: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  contact?: CsContact;
}

export interface CsAttachment {
  url: string;
  filename?: string;
  content_type?: string;
  size?: number;
}

export interface CsMessage {
  id: string;
  conversation_id: string;
  direction: CsMessageDirection;
  author_id: string | null;
  body_text: string | null;
  body_html: string | null;
  attachments: CsAttachment[];
  external_id: string | null;
  email_message_id: string | null;
  in_reply_to: string | null;
  status: CsMessageStatus;
  error: string | null;
  created_at: string;
}
