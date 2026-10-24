ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS sample_subject text,
  ADD COLUMN IF NOT EXISTS sample_html text,
  ADD COLUMN IF NOT EXISTS sample_at timestamptz;