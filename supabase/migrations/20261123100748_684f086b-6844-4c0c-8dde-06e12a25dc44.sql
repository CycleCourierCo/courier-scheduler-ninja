-- Only ever answers for the signed-in user, so it can't be used to probe other people's roles.
CREATE OR REPLACE FUNCTION public.can_see_all_tasks(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _uid IS NOT NULL AND _uid = auth.uid() AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid AND role IN ('admin'::user_role, 'project_manager'::user_role)
  )
$$;

-- Trigger function needs no direct callers and no elevated rights.
CREATE OR REPLACE FUNCTION public.tasks_guard_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS DISTINCT FROM OLD.created_by
     AND auth.uid() IS NOT NULL
     AND NOT public.can_see_all_tasks(auth.uid()) THEN
    NEW.created_by := OLD.created_by;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.tasks_guard_created_by() FROM PUBLIC, anon, authenticated;