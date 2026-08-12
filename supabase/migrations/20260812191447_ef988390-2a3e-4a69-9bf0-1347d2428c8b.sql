ALTER TABLE public.inspection_issues
  ADD COLUMN IF NOT EXISTS invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS invoice_url TEXT,
  ADD COLUMN IF NOT EXISTS invoiced_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS invoiced_by_id UUID,
  ADD COLUMN IF NOT EXISTS invoiced_by_name TEXT;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspection_issues TO authenticated;
GRANT ALL ON public.inspection_issues TO service_role;