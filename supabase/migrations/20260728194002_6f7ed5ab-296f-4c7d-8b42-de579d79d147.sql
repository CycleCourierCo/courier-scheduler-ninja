DROP POLICY IF EXISTS "Box labels: owner can upload" ON storage.objects;
DROP POLICY IF EXISTS "Box labels: owner can update" ON storage.objects;
DROP POLICY IF EXISTS "Box labels: owner can view" ON storage.objects;

CREATE POLICY "Box labels: owner can upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'box-my-bike-labels'
  AND EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id::text = (storage.foldername(name))[1]
      AND o.user_id = (SELECT auth.uid())
      AND (o.is_box_my_bike = true OR o.is_northern_ireland = true)
  )
);

CREATE POLICY "Box labels: owner can update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'box-my-bike-labels'
  AND EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id::text = (storage.foldername(name))[1]
      AND o.user_id = (SELECT auth.uid())
      AND (o.is_box_my_bike = true OR o.is_northern_ireland = true)
  )
)
WITH CHECK (
  bucket_id = 'box-my-bike-labels'
  AND EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id::text = (storage.foldername(name))[1]
      AND o.user_id = (SELECT auth.uid())
      AND (o.is_box_my_bike = true OR o.is_northern_ireland = true)
  )
);

CREATE POLICY "Box labels: owner can view"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'box-my-bike-labels'
  AND EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id::text = (storage.foldername(name))[1]
      AND o.user_id = (SELECT auth.uid())
      AND (o.is_box_my_bike = true OR o.is_northern_ireland = true)
  )
);