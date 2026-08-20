ALTER TABLE public.inspection_issues
  ADD COLUMN IF NOT EXISTS parts_in_stock boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parts_in_stock_at timestamptz,
  ADD COLUMN IF NOT EXISTS parts_in_stock_by_id uuid,
  ADD COLUMN IF NOT EXISTS parts_in_stock_by_name text;