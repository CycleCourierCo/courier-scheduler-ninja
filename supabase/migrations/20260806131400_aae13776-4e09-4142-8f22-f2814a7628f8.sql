ALTER TABLE public.bicycle_inspections
  ADD COLUMN IF NOT EXISTS invoice_skipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS invoice_skipped_by_id uuid,
  ADD COLUMN IF NOT EXISTS invoice_skipped_by_name text,
  ADD COLUMN IF NOT EXISTS invoice_skip_reason text;