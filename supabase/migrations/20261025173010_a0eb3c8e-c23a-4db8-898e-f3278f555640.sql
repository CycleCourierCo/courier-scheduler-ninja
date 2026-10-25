CREATE OR REPLACE FUNCTION public.can_see_fleet_warnings(_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid
    AND role::text IN ('admin','fleet_manager','timeslip_admin','loader'))
$$;