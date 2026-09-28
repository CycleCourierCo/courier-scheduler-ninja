DROP POLICY IF EXISTS "Profiles self update (no role escalation)" ON public.profiles;
DROP FUNCTION IF EXISTS public.current_profile_guard(uuid);
CREATE OR REPLACE FUNCTION public.my_profile_guard()
RETURNS TABLE(role user_role, account_status account_status_type)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT p.role, p.account_status FROM public.profiles p WHERE p.id = auth.uid() $$;
REVOKE EXECUTE ON FUNCTION public.my_profile_guard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_profile_guard() TO authenticated;
CREATE POLICY "Profiles self update (no role escalation)" ON public.profiles
FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = id)
WITH CHECK (
  (SELECT auth.uid()) = id
  AND NOT (role IS DISTINCT FROM (SELECT g.role FROM public.my_profile_guard() g))
  AND NOT (account_status IS DISTINCT FROM (SELECT g.account_status FROM public.my_profile_guard() g))
);