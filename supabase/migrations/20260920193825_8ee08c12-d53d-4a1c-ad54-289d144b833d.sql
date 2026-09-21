ALTER TABLE public.cs_conversations
  ADD COLUMN IF NOT EXISTS ack_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closure_email_sent_at timestamptz;

ALTER TABLE public.cs_messages
  ADD COLUMN IF NOT EXISTS is_automatic boolean NOT NULL DEFAULT false;