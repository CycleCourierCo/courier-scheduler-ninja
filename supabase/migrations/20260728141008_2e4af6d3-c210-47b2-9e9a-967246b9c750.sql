CREATE POLICY "Staff manage foam labels"
ON storage.objects FOR ALL
USING (bucket_id = 'foam-my-bike-labels' AND (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'loader'::user_role) OR has_role(auth.uid(), 'mechanic'::user_role) OR has_role(auth.uid(), 'route_planner'::user_role)))
WITH CHECK (bucket_id = 'foam-my-bike-labels' AND (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'loader'::user_role) OR has_role(auth.uid(), 'mechanic'::user_role) OR has_role(auth.uid(), 'route_planner'::user_role)));

CREATE POLICY "Customers view own foam labels"
ON storage.objects FOR SELECT
USING (bucket_id = 'foam-my-bike-labels' AND EXISTS (
  SELECT 1 FROM public.orders o
  WHERE o.user_id = auth.uid() AND (storage.foldername(objects.name))[1] = o.id::text
));