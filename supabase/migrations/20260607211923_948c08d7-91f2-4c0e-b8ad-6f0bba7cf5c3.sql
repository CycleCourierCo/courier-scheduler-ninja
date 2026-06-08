-- Helper that treats admin and timeslip_admin equivalently for timeslip access
CREATE OR REPLACE FUNCTION public.is_timeslip_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin'::user_role)
      OR public.has_role(auth.uid(), 'timeslip_admin'::user_role)
$$;

-- timeslips policies
DROP POLICY IF EXISTS timeslips_select_policy ON public.timeslips;
CREATE POLICY timeslips_select_policy ON public.timeslips
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE public.is_timeslip_admin()
       OR (timeslips.driver_id = s.uid AND timeslips.status = 'approved')
  )
);

DROP POLICY IF EXISTS timeslips_insert_policy ON public.timeslips;
CREATE POLICY timeslips_insert_policy ON public.timeslips
FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.is_timeslip_admin())
);

DROP POLICY IF EXISTS timeslips_update_policy ON public.timeslips;
CREATE POLICY timeslips_update_policy ON public.timeslips
FOR UPDATE
USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.is_timeslip_admin()))
WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.is_timeslip_admin()));

DROP POLICY IF EXISTS timeslips_delete_policy ON public.timeslips;
CREATE POLICY timeslips_delete_policy ON public.timeslips
FOR DELETE
USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.is_timeslip_admin()));

-- timeslip_generation_logs policies
DROP POLICY IF EXISTS timeslip_generation_logs_select_policy ON public.timeslip_generation_logs;
CREATE POLICY timeslip_generation_logs_select_policy ON public.timeslip_generation_logs
FOR SELECT
USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.is_timeslip_admin()));