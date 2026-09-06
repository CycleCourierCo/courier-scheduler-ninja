ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS shipday_temp_driver_id text,
  ADD COLUMN IF NOT EXISTS shipday_temp_driver_name text;