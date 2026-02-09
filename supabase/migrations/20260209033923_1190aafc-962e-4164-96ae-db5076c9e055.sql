-- Add special rate code to profiles for invoice pricing
ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS special_rate_code text;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.special_rate_code IS 
  'If set, overrides all bike-type pricing with a single Special Rate product in QuickBooks';