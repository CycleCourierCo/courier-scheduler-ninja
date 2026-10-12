CREATE TABLE public.date_chase_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  side text NOT NULL,
  status text NOT NULL,
  error text,
  sent_by uuid,
  sent_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.date_chase_log TO service_role;
ALTER TABLE public.date_chase_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX date_chase_log_order_side_idx ON public.date_chase_log (order_id, side, sent_at DESC);