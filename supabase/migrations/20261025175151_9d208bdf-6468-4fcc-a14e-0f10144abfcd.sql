CREATE OR REPLACE FUNCTION public.fleet_staff_directory()
RETURNS TABLE(id uuid, name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_fleet_staff(auth.uid()) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  RETURN QUERY SELECT DISTINCT p.id, p.name::text FROM public.profiles p
    JOIN public.user_roles r ON r.user_id = p.id
    WHERE r.role::text IN ('admin','fleet_manager') ORDER BY 2;
END $$;
REVOKE EXECUTE ON FUNCTION public.fleet_staff_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fleet_staff_directory() TO authenticated, service_role;