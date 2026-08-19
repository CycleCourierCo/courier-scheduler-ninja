ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS licence_front_path text,
  ADD COLUMN IF NOT EXISTS licence_back_path text,
  ADD COLUMN IF NOT EXISTS licence_check_code_path text,
  ADD COLUMN IF NOT EXISTS licence_number text,
  ADD COLUMN IF NOT EXISTS licence_expiry date,
  ADD COLUMN IF NOT EXISTS licence_updated_at timestamptz;