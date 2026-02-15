
DROP POLICY IF EXISTS "orders_authenticated_select_policy" ON public.orders;

CREATE POLICY "orders_authenticated_select_policy"
ON public.orders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE public.has_role(s.uid, 'admin')
       OR public.has_role(s.uid, 'route_planner')
       OR orders.user_id = s.uid
  )
);
