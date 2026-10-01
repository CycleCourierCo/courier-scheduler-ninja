ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS booked_by_id uuid, ADD COLUMN IF NOT EXISTS booked_by_name text;
DROP POLICY IF EXISTS "Consolidated orders INSERT policy" ON public.orders;
CREATE POLICY "Consolidated orders INSERT policy" ON public.orders FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid,'admin'::user_role) OR has_role(s.uid,'cs_agent'::user_role))
  OR (((SELECT auth.uid()) = user_id) AND (has_role(auth.uid(),'b2b_customer'::user_role) OR has_role(auth.uid(),'b2c_customer'::user_role) OR has_role(auth.uid(),'sales'::user_role) OR has_role(auth.uid(),'route_planner'::user_role)))
);