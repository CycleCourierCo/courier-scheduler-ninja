CREATE TABLE public.order_update_run_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Europe/London')::date,
  chunk_offset integer NOT NULL DEFAULT 0,
  scanned integer NOT NULL DEFAULT 0,
  due integer NOT NULL DEFAULT 0,
  sent integer NOT NULL DEFAULT 0,
  skipped integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  source text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.order_update_run_log TO authenticated;
GRANT ALL ON public.order_update_run_log TO service_role;

ALTER TABLE public.order_update_run_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view update run log"
ON public.order_update_run_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::user_role));

CREATE INDEX idx_order_update_run_log_date ON public.order_update_run_log (run_date DESC);