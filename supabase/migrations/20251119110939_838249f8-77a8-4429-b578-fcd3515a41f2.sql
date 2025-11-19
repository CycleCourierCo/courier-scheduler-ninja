-- Add location fields to driver_checkins table
ALTER TABLE public.driver_checkins
ADD COLUMN checkin_latitude double precision,
ADD COLUMN checkin_longitude double precision,
ADD COLUMN distance_from_depot_meters integer;

COMMENT ON COLUMN public.driver_checkins.checkin_latitude IS 'GPS latitude where check-in was submitted';
COMMENT ON COLUMN public.driver_checkins.checkin_longitude IS 'GPS longitude where check-in was submitted';
COMMENT ON COLUMN public.driver_checkins.distance_from_depot_meters IS 'Calculated distance from depot in meters';

-- Create validation function for check-in location
CREATE OR REPLACE FUNCTION public.validate_checkin_location(
  p_lat double precision,
  p_lon double precision
)
RETURNS TABLE (
  is_valid boolean,
  distance_meters integer,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_depot_lat CONSTANT double precision := 52.4690197;
  v_depot_lon CONSTANT double precision := -1.8757663;
  v_max_distance_meters CONSTANT integer := 500;
  v_distance integer;
BEGIN
  -- Calculate distance using Haversine formula
  v_distance := (
    6371000 * acos(
      cos(radians(p_lat)) * cos(radians(v_depot_lat)) *
      cos(radians(v_depot_lon) - radians(p_lon)) +
      sin(radians(p_lat)) * sin(radians(v_depot_lat))
    )
  )::integer;
  
  RETURN QUERY SELECT
    v_distance <= v_max_distance_meters AS is_valid,
    v_distance AS distance_meters,
    CASE
      WHEN v_distance <= v_max_distance_meters THEN 'Location verified'::text
      ELSE format('You must be within %sm of the depot. You are %sm away.', v_max_distance_meters, v_distance)
    END AS error_message;
END;
$$;