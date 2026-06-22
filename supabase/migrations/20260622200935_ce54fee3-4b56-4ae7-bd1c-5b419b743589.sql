CREATE TABLE public.email_delivery_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  resend_email_id TEXT,
  recipient TEXT,
  event_type TEXT NOT NULL,
  order_id UUID,
  side TEXT,
  email_type TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_delivery_events_order ON public.email_delivery_events (order_id, side, created_at DESC);
CREATE INDEX idx_email_delivery_events_resend_id ON public.email_delivery_events (resend_email_id);

GRANT SELECT ON public.email_delivery_events TO authenticated;
GRANT ALL ON public.email_delivery_events TO service_role;

ALTER TABLE public.email_delivery_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal staff can read email delivery events"
ON public.email_delivery_events
FOR SELECT
TO authenticated
USING (public.is_internal_staff(auth.uid()));