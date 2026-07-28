DROP POLICY IF EXISTS "Staff manage foam labels" ON storage.objects;

CREATE POLICY "Staff manage foam labels"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'foam-my-bike-labels'
  AND (
    public.has_role(auth.uid(), 'admin'::user_role)
    OR public.has_role(auth.uid(), 'loader'::user_role)
    OR public.has_role(auth.uid(), 'mechanic'::user_role)
    OR public.has_role(auth.uid(), 'route_planner'::user_role)
    OR public.has_role(auth.uid(), 'cs_agent'::user_role)
  )
)
WITH CHECK (
  bucket_id = 'foam-my-bike-labels'
  AND (
    public.has_role(auth.uid(), 'admin'::user_role)
    OR public.has_role(auth.uid(), 'loader'::user_role)
    OR public.has_role(auth.uid(), 'mechanic'::user_role)
    OR public.has_role(auth.uid(), 'route_planner'::user_role)
    OR public.has_role(auth.uid(), 'cs_agent'::user_role)
  )
);

DROP POLICY IF EXISTS "Foam labels: owner can upload" ON storage.objects;
CREATE POLICY "Foam labels: owner can upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'foam-my-bike-labels'
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id::text = (storage.foldername(name))[1]
      AND o.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Foam labels: owner can update" ON storage.objects;
CREATE POLICY "Foam labels: owner can update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'foam-my-bike-labels'
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id::text = (storage.foldername(name))[1]
      AND o.user_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'foam-my-bike-labels'
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id::text = (storage.foldername(name))[1]
      AND o.user_id = auth.uid()
  )
);