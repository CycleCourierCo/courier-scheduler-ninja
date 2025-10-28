-- Phase 2: Add driver fields to profiles table
-- Add driver-specific fields to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS hourly_rate numeric DEFAULT 11.00,
ADD COLUMN IF NOT EXISTS uses_own_van boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS van_allowance numeric DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS available_hours integer DEFAULT 9,
ADD COLUMN IF NOT EXISTS shipday_driver_id text;

-- Create index for Shipday driver ID lookups
CREATE INDEX IF NOT EXISTS idx_profiles_shipday_driver_id 
ON public.profiles(shipday_driver_id) 
WHERE shipday_driver_id IS NOT NULL;

-- Update RLS policies to allow drivers to view their own driver-specific fields
-- (Already covered by existing "Users can view their own profile" policy)

-- Create a function to sync driver data from drivers table to profiles
-- This is a one-time migration helper since drivers table is empty
CREATE OR REPLACE FUNCTION public.sync_drivers_to_profiles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Update profiles with driver data where email matches
  UPDATE profiles p
  SET 
    hourly_rate = d.hourly_rate,
    uses_own_van = d.uses_own_van,
    van_allowance = d.van_allowance,
    is_active = d.is_active,
    available_hours = d.available_hours
  FROM drivers d
  WHERE p.email = d.email;
END;
$$;

-- Run the sync (safe since drivers table is empty)
SELECT public.sync_drivers_to_profiles();