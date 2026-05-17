
CREATE OR REPLACE FUNCTION public.is_admin_or_sales()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.has_role(auth.uid(), 'admin'::user_role)
      OR public.has_role(auth.uid(), 'sales'::user_role)
$$;

DROP POLICY IF EXISTS "Consolidated profiles SELECT policy" ON public.profiles;
CREATE POLICY "Consolidated profiles SELECT policy"
ON public.profiles
FOR SELECT
USING (((SELECT auth.uid()) = id) OR public.is_admin_or_sales());

DROP POLICY IF EXISTS "Consolidated profiles UPDATE policy" ON public.profiles;
CREATE POLICY "Consolidated profiles UPDATE policy"
ON public.profiles
FOR UPDATE
USING (((SELECT auth.uid()) = id) OR public.is_admin_or_sales())
WITH CHECK (((SELECT auth.uid()) = id) OR public.is_admin_or_sales());

DROP POLICY IF EXISTS "user_roles_select_policy" ON public.user_roles;
CREATE POLICY "user_roles_select_policy"
ON public.user_roles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role)
       OR has_role(s.uid, 'sales'::user_role)
       OR (user_roles.user_id = s.uid)
  )
);
