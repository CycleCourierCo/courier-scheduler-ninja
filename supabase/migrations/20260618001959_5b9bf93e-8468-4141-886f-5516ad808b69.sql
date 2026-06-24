DROP POLICY IF EXISTS orders_authenticated_select_policy ON public.orders;

CREATE POLICY orders_authenticated_select_policy
ON public.orders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role)
       OR has_role(s.uid, 'route_planner'::user_role)
       OR has_role(s.uid, 'loader'::user_role)
       OR has_role(s.uid, 'mechanic'::user_role)
       OR orders.user_id = s.uid
  )
);