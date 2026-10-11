ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancelled_at timestamptz, ADD COLUMN IF NOT EXISTS cancelled_by uuid;

UPDATE public.orders SET cancelled_at = (tracking_events->'shipday'->>'cancelled_at')::timestamptz
WHERE status='cancelled' AND cancelled_at IS NULL AND tracking_events->'shipday'->>'cancelled_at' IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_order_cancelled_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'cancelled' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'cancelled') THEN
    NEW.cancelled_at := coalesce(NEW.cancelled_at, now());
    NEW.cancelled_by := coalesce(NEW.cancelled_by, auth.uid());
  ELSIF NEW.status <> 'cancelled' AND TG_OP='UPDATE' AND OLD.status = 'cancelled' THEN
    NEW.cancelled_at := NULL; NEW.cancelled_by := NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_set_order_cancelled_at ON public.orders;
CREATE TRIGGER trg_set_order_cancelled_at BEFORE INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.set_order_cancelled_at();

CREATE TABLE public.cancelled_invoice_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  quickbooks_invoice_id text NOT NULL,
  note text,
  resolved_by uuid,
  resolved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, quickbooks_invoice_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cancelled_invoice_reviews TO authenticated;
GRANT ALL ON public.cancelled_invoice_reviews TO service_role;
ALTER TABLE public.cancelled_invoice_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage cancelled invoice reviews" ON public.cancelled_invoice_reviews FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u JOIN public.user_roles r ON r.user_id=u.uid WHERE r.role IN ('admin','cs_agent'))
    OR EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u JOIN public.profiles p ON p.id=u.uid WHERE p.role IN ('admin','cs_agent')))
WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u JOIN public.user_roles r ON r.user_id=u.uid WHERE r.role IN ('admin','cs_agent'))
    OR EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u JOIN public.profiles p ON p.id=u.uid WHERE p.role IN ('admin','cs_agent')));

CREATE OR REPLACE FUNCTION public.cancelled_invoiced_orders()
RETURNS TABLE(order_id uuid, tracking_number text, customer_name text, order_created_at timestamptz, cancelled_at timestamptz,
  quickbooks_invoice_id text, quickbooks_invoice_number text, quickbooks_invoice_url text, invoice_date date,
  transport_net_amount numeric, timing text, resolved_at timestamptz, resolution_note text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=auth.uid() AND r.role IN ('admin','cs_agent'))
       OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role IN ('admin','cs_agent'))) THEN
    RAISE EXCEPTION 'Admin or customer service access required';
  END IF;
  RETURN QUERY
  SELECT o.id, o.tracking_number::text,
    coalesce(nullif(p.company_name,''), p.name, o.sender->>'name')::text,
    o.created_at, o.cancelled_at, l.quickbooks_invoice_id, l.quickbooks_invoice_number, l.quickbooks_invoice_url,
    l.invoice_date::date, l.transport_net_amount::numeric,
    CASE WHEN o.cancelled_at IS NULL OR l.invoice_date IS NULL THEN 'unknown'
         WHEN (o.cancelled_at AT TIME ZONE 'Europe/London')::date >= l.invoice_date::date THEN 'after'
         ELSE 'before' END,
    rv.resolved_at, rv.note
  FROM public.orders o
  JOIN public.order_invoice_links l ON l.order_id=o.id
  LEFT JOIN public.profiles p ON p.id=o.user_id
  LEFT JOIN public.cancelled_invoice_reviews rv ON rv.order_id=o.id AND rv.quickbooks_invoice_id=l.quickbooks_invoice_id
  WHERE o.status='cancelled'
  ORDER BY l.invoice_date DESC NULLS LAST;
END $$;
REVOKE ALL ON FUNCTION public.cancelled_invoiced_orders() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cancelled_invoiced_orders() TO authenticated;