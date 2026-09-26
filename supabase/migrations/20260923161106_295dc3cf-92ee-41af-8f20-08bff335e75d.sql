DO $$
DECLARE keep_id uuid; dup_id uuid;
BEGIN
  SELECT id INTO keep_id FROM public.bicycle_inspections
   WHERE order_id = 'fdee3213-b30e-4a15-a94d-98f47ec36fe3' ORDER BY created_at ASC LIMIT 1;
  FOR dup_id IN
    SELECT id FROM public.bicycle_inspections
     WHERE order_id = 'fdee3213-b30e-4a15-a94d-98f47ec36fe3' AND id <> keep_id
  LOOP
    UPDATE public.inspection_issues SET inspection_id = keep_id WHERE inspection_id = dup_id;
    DELETE FROM public.bicycle_inspections WHERE id = dup_id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS bicycle_inspections_order_id_unique
  ON public.bicycle_inspections (order_id) WHERE order_id IS NOT NULL;