CREATE POLICY "Staff manage foam delivery photos"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'foam-delivery-photos'
  AND (
    public.has_role(auth.uid(), 'admin'::user_role)
    OR public.has_role(auth.uid(), 'loader'::user_role)
    OR public.has_role(auth.uid(), 'mechanic'::user_role)
    OR public.has_role(auth.uid(), 'route_planner'::user_role)
  )
)
WITH CHECK (
  bucket_id = 'foam-delivery-photos'
  AND (
    public.has_role(auth.uid(), 'admin'::user_role)
    OR public.has_role(auth.uid(), 'loader'::user_role)
    OR public.has_role(auth.uid(), 'mechanic'::user_role)
    OR public.has_role(auth.uid(), 'route_planner'::user_role)
  )
);

CREATE POLICY "Customers view own foam delivery photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'foam-delivery-photos'
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.user_id = auth.uid()
      AND (storage.foldername(name))[1] = o.id::text
  )
);