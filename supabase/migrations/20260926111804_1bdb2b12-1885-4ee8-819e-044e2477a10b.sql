CREATE OR REPLACE FUNCTION public.current_profile_guard(_uid uuid)
RETURNS TABLE(role user_role, account_status account_status_type)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT p.role, p.account_status FROM public.profiles p WHERE p.id = _uid $$;
REVOKE EXECUTE ON FUNCTION public.current_profile_guard(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_profile_guard(uuid) TO authenticated;

DROP POLICY IF EXISTS "Profiles self update (no role escalation)" ON public.profiles;
CREATE POLICY "Profiles self update (no role escalation)" ON public.profiles
FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = id)
WITH CHECK (
  (SELECT auth.uid()) = id
  AND NOT (role IS DISTINCT FROM (SELECT g.role FROM public.current_profile_guard((SELECT auth.uid())) g))
  AND NOT (account_status IS DISTINCT FROM (SELECT g.account_status FROM public.current_profile_guard((SELECT auth.uid())) g))
);