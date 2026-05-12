DROP POLICY IF EXISTS contacts_select_policy ON public.contacts;

CREATE POLICY contacts_select_policy
ON public.contacts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role)
       OR has_role(s.uid, 'route_planner'::user_role)
       OR contacts.user_id = s.uid
  )
);