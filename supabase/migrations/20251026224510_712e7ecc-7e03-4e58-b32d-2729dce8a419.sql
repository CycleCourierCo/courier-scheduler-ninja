-- Drop the old foreign key constraint on timeslips.driver_id
ALTER TABLE public.timeslips 
DROP CONSTRAINT IF EXISTS timeslips_driver_id_fkey;

-- Add new foreign key constraint referencing profiles
ALTER TABLE public.timeslips 
ADD CONSTRAINT timeslips_driver_id_fkey 
FOREIGN KEY (driver_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;