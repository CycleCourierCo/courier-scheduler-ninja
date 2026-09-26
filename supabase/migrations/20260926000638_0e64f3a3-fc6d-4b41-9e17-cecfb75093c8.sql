CREATE OR REPLACE FUNCTION public.list_internal_users()
 RETURNS TABLE(id uuid, name text, email text, is_active boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT DISTINCT p.id, p.name, p.email,
    COALESCE(p.is_active, true) AND COALESCE(p.account_status::text,'') NOT IN ('suspended','rejected')
  FROM public.profiles p
  WHERE public.is_internal_staff(auth.uid())
    AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id
      AND ur.role IN ('admin','cs_agent','route_planner','loader','driver','sales','timeslip_admin','mechanic'))
  ORDER BY p.name NULLS LAST, p.email;
$$;

CREATE OR REPLACE FUNCTION public.cancel_absences_on_deactivate() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF (COALESCE(OLD.is_active, true) AND NEW.is_active = false)
     OR (COALESCE(OLD.account_status::text,'') NOT IN ('suspended','rejected')
         AND COALESCE(NEW.account_status::text,'') IN ('suspended','rejected')) THEN
    UPDATE public.driver_absence_requests SET status = 'cancelled'
    WHERE driver_id = NEW.id AND status = 'pending';
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.cancel_absences_on_deactivate() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS profiles_cancel_absences ON public.profiles;
CREATE TRIGGER profiles_cancel_absences AFTER UPDATE OF is_active, account_status ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.cancel_absences_on_deactivate();

DO $d$
DECLARE v text;
BEGIN
  SELECT pg_get_functiondef('public.guard_driver_absence_request()'::regprocedure) INTO v;
  v := replace(v, 'WHERE id = NEW.driver_id AND COALESCE(is_active, true))',
    'WHERE id = NEW.driver_id AND COALESCE(is_active, true) AND COALESCE(account_status::text,'''') NOT IN (''suspended'',''rejected''))');
  EXECUTE v;
END $d$;