DROP POLICY IF EXISTS "saved_routes_select_policy" ON public.saved_routes;
DROP POLICY IF EXISTS "saved_routes_insert_policy" ON public.saved_routes;
DROP POLICY IF EXISTS "saved_routes_update_policy" ON public.saved_routes;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_routes TO authenticated;
GRANT ALL ON public.saved_routes TO service_role;

CREATE POLICY "saved_routes_select_policy" ON public.saved_routes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role)
         OR has_role(s.uid, 'route_planner'::user_role)
         OR created_by = s.uid
    )
  );

CREATE POLICY "saved_routes_insert_policy" ON public.saved_routes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role)
         OR has_role(s.uid, 'route_planner'::user_role)
         OR created_by = s.uid
    )
  );

CREATE POLICY "saved_routes_update_policy" ON public.saved_routes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role)
         OR has_role(s.uid, 'route_planner'::user_role)
         OR created_by = s.uid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM (SELECT auth.uid() AS uid) s
      WHERE has_role(s.uid, 'admin'::user_role)
         OR has_role(s.uid, 'route_planner'::user_role)
         OR created_by = s.uid
    )
  );