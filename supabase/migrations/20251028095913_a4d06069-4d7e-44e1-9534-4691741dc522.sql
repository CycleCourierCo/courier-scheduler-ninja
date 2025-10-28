-- Drop the old RLS policy that references the drivers table
DROP POLICY IF EXISTS "Drivers can view their approved timeslips" ON timeslips;

-- Create new simplified RLS policy that uses profiles directly
CREATE POLICY "Drivers can view their approved timeslips" ON timeslips
FOR SELECT USING (
  driver_id = auth.uid() 
  AND has_role(auth.uid(), 'driver'::user_role) 
  AND status = 'approved'
);

-- Update foreign key on timeslips to reference profiles instead of drivers
ALTER TABLE timeslips DROP CONSTRAINT IF EXISTS timeslips_driver_id_fkey;
ALTER TABLE timeslips 
ADD CONSTRAINT timeslips_driver_id_fkey 
FOREIGN KEY (driver_id) 
REFERENCES profiles(id) 
ON DELETE CASCADE;

-- Drop the sync function (no longer needed)
DROP FUNCTION IF EXISTS public.sync_drivers_to_profiles();

-- Drop the drivers table
DROP TABLE IF EXISTS public.drivers CASCADE;