CREATE TABLE public.order_update_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  side text NOT NULL,
  stage_key text NOT NULL,
  recipient text,
  subject text,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_update_log_order ON public.order_update_log (order_id, side, sent_at DESC);

GRANT SELECT ON public.order_update_log TO authenticated;
GRANT ALL ON public.order_update_log TO service_role;

ALTER TABLE public.order_update_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal staff can view order update log"
ON public.order_update_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) a
    WHERE public.is_internal_staff(a.uid)
  )
);

CREATE POLICY "Service role manages order update log"
ON public.order_update_log
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);