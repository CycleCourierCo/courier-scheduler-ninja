
CREATE TABLE public.cs_channel_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL CHECK (channel IN ('email','whatsapp')),
  address text NOT NULL,
  label text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel, address)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cs_channel_endpoints TO authenticated;
GRANT ALL ON public.cs_channel_endpoints TO service_role;
ALTER TABLE public.cs_channel_endpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cs admins/agents manage endpoints" ON public.cs_channel_endpoints
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u
    WHERE public.has_role(u.uid,'admin'::user_role) OR public.has_role(u.uid,'cs_agent'::user_role)))
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u
    WHERE public.has_role(u.uid,'admin'::user_role) OR public.has_role(u.uid,'cs_agent'::user_role)));

CREATE TABLE public.cs_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL CHECK (channel IN ('email','whatsapp')),
  handle text NOT NULL,
  display_name text,
  linked_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel, handle)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cs_contacts TO authenticated;
GRANT ALL ON public.cs_contacts TO service_role;
ALTER TABLE public.cs_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cs admins/agents manage contacts" ON public.cs_contacts
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u
    WHERE public.has_role(u.uid,'admin'::user_role) OR public.has_role(u.uid,'cs_agent'::user_role)))
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u
    WHERE public.has_role(u.uid,'admin'::user_role) OR public.has_role(u.uid,'cs_agent'::user_role)));

CREATE TABLE public.cs_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL CHECK (channel IN ('email','whatsapp')),
  contact_id uuid NOT NULL REFERENCES public.cs_contacts(id) ON DELETE CASCADE,
  subject text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','pending','snoozed','closed')),
  assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_preview text,
  unread_count int NOT NULL DEFAULT 0,
  snooze_until timestamptz,
  linked_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  suggested_order_ids uuid[] NOT NULL DEFAULT '{}',
  auto_link_locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cs_conversations_last_msg_idx ON public.cs_conversations (last_message_at DESC);
CREATE INDEX cs_conversations_status_idx ON public.cs_conversations (status);
CREATE INDEX cs_conversations_assignee_idx ON public.cs_conversations (assignee_id);
CREATE INDEX cs_conversations_contact_idx ON public.cs_conversations (contact_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cs_conversations TO authenticated;
GRANT ALL ON public.cs_conversations TO service_role;
ALTER TABLE public.cs_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cs admins/agents manage conversations" ON public.cs_conversations
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u
    WHERE public.has_role(u.uid,'admin'::user_role) OR public.has_role(u.uid,'cs_agent'::user_role)))
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u
    WHERE public.has_role(u.uid,'admin'::user_role) OR public.has_role(u.uid,'cs_agent'::user_role)));

CREATE TABLE public.cs_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.cs_conversations(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('in','out','note')),
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  body_text text,
  body_html text,
  attachments jsonb NOT NULL DEFAULT '[]',
  external_id text,
  email_message_id text,
  in_reply_to text,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','sent','failed','delivered','read')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cs_messages_conv_idx ON public.cs_messages (conversation_id, created_at);
CREATE INDEX cs_messages_email_msg_id_idx ON public.cs_messages (email_message_id) WHERE email_message_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cs_messages TO authenticated;
GRANT ALL ON public.cs_messages TO service_role;
ALTER TABLE public.cs_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cs admins/agents manage messages" ON public.cs_messages
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u
    WHERE public.has_role(u.uid,'admin'::user_role) OR public.has_role(u.uid,'cs_agent'::user_role)))
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u
    WHERE public.has_role(u.uid,'admin'::user_role) OR public.has_role(u.uid,'cs_agent'::user_role)));

CREATE TRIGGER cs_contacts_updated_at BEFORE UPDATE ON public.cs_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER cs_conversations_updated_at BEFORE UPDATE ON public.cs_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.cs_conversations;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.cs_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.cs_conversations REPLICA IDENTITY FULL;
ALTER TABLE public.cs_messages REPLICA IDENTITY FULL;
