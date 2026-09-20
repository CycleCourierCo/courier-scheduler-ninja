ALTER TABLE public.cs_messages
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS delivery_status text,
  ADD COLUMN IF NOT EXISTS delivery_events jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS system_event text;

CREATE INDEX IF NOT EXISTS cs_messages_provider_message_id_idx
  ON public.cs_messages (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

ALTER TABLE public.cs_conversations
  ADD COLUMN IF NOT EXISTS has_delivery_problem boolean NOT NULL DEFAULT false;