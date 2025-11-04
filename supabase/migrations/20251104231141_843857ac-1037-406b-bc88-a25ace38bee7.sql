-- Add shipday_driver_name column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS shipday_driver_name text;

COMMENT ON COLUMN public.profiles.shipday_driver_name IS 'Abbreviated driver name used in Shipday orders (e.g., "Hass" for Hassan Mirza)';