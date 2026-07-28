DROP POLICY IF EXISTS "Staff manage foam labels" ON storage.objects;

CREATE POLICY "Staff manage foam labels"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'foam-my-bike-labels'
  AND (
    public.has_role((SELECT auth.uid()), 'admin'::public.user_role)
    OR public.has_role((SELECT auth.uid()), 'loader'::public.user_role)
    OR public.has_role((SELECT auth.uid()), 'mechanic'::public.user_role)
    OR public.has_role((SELECT auth.uid()), 'route_planner'::public.user_role)
    OR public.has_role((SELECT auth.uid()), 'cs_agent'::public.user_role)
    OR public.has_role((SELECT auth.uid()), 'timeslip_admin'::public.user_role)
  )
)
WITH CHECK (
  bucket_id = 'foam-my-bike-labels'
  AND (
    public.has_role((SELECT auth.uid()), 'admin'::public.user_role)
    OR public.has_role((SELECT auth.uid()), 'loader'::public.user_role)
    OR public.has_role((SELECT auth.uid()), 'mechanic'::public.user_role)
    OR public.has_role((SELECT auth.uid()), 'route_planner'::public.user_role)
    OR public.has_role((SELECT auth.uid()), 'cs_agent'::public.user_role)
    OR public.has_role((SELECT auth.uid()), 'timeslip_admin'::public.user_role)
  )
);