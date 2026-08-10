ALTER TABLE public.weekly_invoice_batch_logs
  ADD COLUMN IF NOT EXISTS report_status text,
  ADD COLUMN IF NOT EXISTS report_http_status integer,
  ADD COLUMN IF NOT EXISTS report_error text,
  ADD COLUMN IF NOT EXISTS report_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS report_recipient text;