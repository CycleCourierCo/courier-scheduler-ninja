ALTER TABLE public.workshop_settings
  ADD COLUMN IF NOT EXISTS inspection_standard_minutes integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS default_repair_minutes integer NOT NULL DEFAULT 30;