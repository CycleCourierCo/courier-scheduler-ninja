CREATE OR REPLACE FUNCTION public.difficult_areas_geojson()
RETURNS TABLE(id uuid, name text, max_route_hours numeric, geojson jsonb)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT d.id, d.name, d.max_route_hours, ST_AsGeoJSON(d.geom)::jsonb
  FROM public.difficult_areas d
  WHERE d.active
$$;

REVOKE ALL ON FUNCTION public.difficult_areas_geojson() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.difficult_areas_geojson() FROM anon;
GRANT EXECUTE ON FUNCTION public.difficult_areas_geojson() TO authenticated;
GRANT EXECUTE ON FUNCTION public.difficult_areas_geojson() TO service_role;