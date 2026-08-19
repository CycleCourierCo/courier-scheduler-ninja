ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS box_buyer jsonb,
  ADD COLUMN IF NOT EXISTS box_buyer_boxing_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS box_buyer_collected_email_sent_at timestamptz;