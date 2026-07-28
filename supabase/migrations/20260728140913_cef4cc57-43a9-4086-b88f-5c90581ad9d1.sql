ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS foam_label_url text,
  ADD COLUMN IF NOT EXISTS foam_tracking_url text,
  ADD COLUMN IF NOT EXISTS foam_label_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS foam_label_uploaded_by uuid;