
-- RLS policies for box-my-bike-labels storage bucket
-- Path convention: <order_id>/<filename>

-- Order owner can manage labels for their own Box My Bike orders
CREATE POLICY "Box labels: owner can view"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'box-my-bike-labels'
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id::text = (storage.foldername(name))[1]
      AND o.user_id = auth.uid()
      AND o.is_box_my_bike = true
  )
);

CREATE POLICY "Box labels: owner can upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'box-my-bike-labels'
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id::text = (storage.foldername(name))[1]
      AND o.user_id = auth.uid()
      AND o.is_box_my_bike = true
  )
);

CREATE POLICY "Box labels: owner can update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'box-my-bike-labels'
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id::text = (storage.foldername(name))[1]
      AND o.user_id = auth.uid()
      AND o.is_box_my_bike = true
  )
);

-- Admin / internal staff full access
CREATE POLICY "Box labels: admin all"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'box-my-bike-labels'
  AND (
    public.has_role(auth.uid(), 'admin'::user_role)
    OR public.has_role(auth.uid(), 'cs_agent'::user_role)
    OR public.has_role(auth.uid(), 'loader'::user_role)
  )
)
WITH CHECK (
  bucket_id = 'box-my-bike-labels'
  AND (
    public.has_role(auth.uid(), 'admin'::user_role)
    OR public.has_role(auth.uid(), 'cs_agent'::user_role)
    OR public.has_role(auth.uid(), 'loader'::user_role)
  )
);
