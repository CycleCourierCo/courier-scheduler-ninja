ALTER POLICY claims_team_insert
ON public.claims
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE public.has_role(s.uid, 'admin'::public.user_role)
       OR public.has_role(s.uid, 'cs_agent'::public.user_role)
  )
);