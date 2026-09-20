export type CsChannel = 'email' | 'whatsapp';
export type CsConversationStatus = 'open' | 'pending' | 'snoozed' | 'closed';
export type CsMessageDirection = 'in' | 'out' | 'note';
export type CsMessageStatus = 'received' | 'sent' | 'failed' | 'delivered' | 'read';
export type CsPriority = 'low' | 'normal' | 'high' | 'urgent';

export const CS_PRIORITIES: CsPriority[] = ['low', 'normal', 'high', 'urgent'];

export interface CsQueue {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CsQueueMember {
  id: string;
  queue_id: string;
  user_id: string;
  is_active: boolean;
  sort_order: number;
}

export interface CsQueueSla {
  id: string;
  queue_id: string;
  priority: CsPriority;
  target_minutes: number;
}

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
  ticket_ref: string | null;
  queue_id: string | null;
  priority: CsPriority;
  first_response_due_at: string | null;
  next_response_due_at: string | null;
  assigned_manually: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  contact?: CsContact;
  queue?: Pick<CsQueue, 'id' | 'name' | 'slug'> | null;
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
