ALTER TABLE public.fuel_transactions
  ADD COLUMN IF NOT EXISTS correction_note text,
  ADD COLUMN IF NOT EXISTS corrected_at timestamptz,
  ADD COLUMN IF NOT EXISTS corrected_by uuid;