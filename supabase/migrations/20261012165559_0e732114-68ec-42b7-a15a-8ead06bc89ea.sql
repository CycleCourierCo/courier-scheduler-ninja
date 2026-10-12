CREATE TABLE public.sms_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid,
  recipient_masked text,
  type text NOT NULL,
  side text,
  provider_id text,
  status text NOT NULL DEFAULT 'sent',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sms_messages TO authenticated;
GRANT ALL ON public.sms_messages TO service_role;
ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view sms messages" ON public.sms_messages FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u JOIN public.user_roles r ON r.user_id = u.uid WHERE r.role IN ('admin','cs_agent')));
CREATE INDEX sms_messages_provider_id_idx ON public.sms_messages(provider_id);
CREATE INDEX sms_messages_order_id_idx ON public.sms_messages(order_id);

CREATE TABLE public.divergent_webhook_events (
  webhook_id text PRIMARY KEY,
  received_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.divergent_webhook_events TO service_role;
ALTER TABLE public.divergent_webhook_events ENABLE ROW LEVEL SECURITY;