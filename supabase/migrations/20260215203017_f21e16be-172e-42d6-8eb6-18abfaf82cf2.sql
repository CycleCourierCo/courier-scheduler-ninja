CREATE POLICY "orders_route_planner_update_policy"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE public.has_role(s.uid, 'route_planner')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE public.has_role(s.uid, 'route_planner')
  )
);