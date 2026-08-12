ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS guaranteed_delivery boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS guaranteed_delivery_payer text,
  ADD COLUMN IF NOT EXISTS guaranteed_delivery_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS guaranteed_delivery_note text,
  ADD COLUMN IF NOT EXISTS guaranteed_delivery_marked_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS guaranteed_delivery_marked_by_id uuid,
  ADD COLUMN IF NOT EXISTS guaranteed_delivery_marked_by_name text,
  ADD COLUMN IF NOT EXISTS guaranteed_delivery_invoice_number text,
  ADD COLUMN IF NOT EXISTS guaranteed_delivery_invoice_id text,
  ADD COLUMN IF NOT EXISTS guaranteed_delivery_invoice_url text,
  ADD COLUMN IF NOT EXISTS guaranteed_delivery_invoiced_at timestamp with time zone;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_guaranteed_delivery_payer_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_guaranteed_delivery_payer_check
  CHECK (guaranteed_delivery_payer IS NULL OR guaranteed_delivery_payer IN ('account', 'sender', 'receiver'));