ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS bike_preparation_email_sent_at timestamptz;