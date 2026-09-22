CREATE OR REPLACE FUNCTION public.get_planning_vans()
RETURNS TABLE(id uuid, name text, bike_spaces integer, status text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::user_role)
    OR public.has_role(auth.uid(), 'sales'::user_role)
    OR public.has_role(auth.uid(), 'route_planner'::user_role)
  ) THEN
    RAISE EXCEPTION 'not_authorised';
  END IF;

  RETURN QUERY
  SELECT v.id,
         COALESCE(NULLIF(v.registration, ''), NULLIF(v.make, ''), 'Van')::text AS name,
         v.bike_spaces::integer,
         v.status::text
  FROM public.vehicles v
  WHERE v.status::text IN ('in_use', 'off_road')
  ORDER BY v.registration;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_planning_vans() TO authenticated;