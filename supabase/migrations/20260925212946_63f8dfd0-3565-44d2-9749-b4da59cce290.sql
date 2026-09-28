DROP FUNCTION IF EXISTS public.list_internal_users();
CREATE FUNCTION public.list_internal_users()
 RETURNS TABLE(id uuid, name text, email text, is_active boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT DISTINCT p.id, p.name, p.email, COALESCE(p.is_active, true)
  FROM public.profiles p
  WHERE public.is_internal_staff(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = p.id
        AND ur.role IN ('admin','cs_agent','route_planner','loader','driver','sales','timeslip_admin','mechanic')
    )
  ORDER BY p.name NULLS LAST, p.email;
$function$;
REVOKE EXECUTE ON FUNCTION public.list_internal_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_internal_users() TO authenticated;