ALTER TABLE public.bicycle_inspections
  ADD COLUMN IF NOT EXISTS service_invoice_id text,
  ADD COLUMN IF NOT EXISTS service_invoice_number text,
  ADD COLUMN IF NOT EXISTS service_invoiced_at timestamptz;