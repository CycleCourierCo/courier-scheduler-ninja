-- Remove driver check-in related tables and functions

-- Drop the trigger first
DROP TRIGGER IF EXISTS update_driver_checkins_updated_at ON public.driver_checkins;

-- Drop tables (this will cascade delete RLS policies)
DROP TABLE IF EXISTS public.weekly_checkin_bonuses CASCADE;
DROP TABLE IF EXISTS public.driver_checkins CASCADE;

-- Drop database functions
DROP FUNCTION IF EXISTS public.validate_checkin_location(double precision, double precision);
DROP FUNCTION IF EXISTS public.calculate_weekly_checkin_compliance(uuid, date, date);

-- Delete the storage bucket (objects must be deleted first via the dashboard or API)
-- Note: Storage bucket deletion should be done via dashboard if it contains files
DELETE FROM storage.buckets WHERE id = 'driver-checkins';