ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS quickbooks_invoice_public_url text,
  ADD COLUMN IF NOT EXISTS guaranteed_delivery_invoice_public_url text,
  ADD COLUMN IF NOT EXISTS box_my_bike_invoice_public_url text;

ALTER TABLE public.inspection_issues
  ADD COLUMN IF NOT EXISTS invoice_public_url text;

ALTER TABLE public.bicycle_inspections
  ADD COLUMN IF NOT EXISTS invoice_public_url text;

ALTER TABLE public.invoice_history
  ADD COLUMN IF NOT EXISTS quickbooks_invoice_public_url text;