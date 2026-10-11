DROP FUNCTION public.cancelled_invoiced_orders();
CREATE FUNCTION public.cancelled_invoiced_orders()
 RETURNS TABLE(order_id uuid, tracking_number text, customer_name text, order_created_at timestamp with time zone, cancelled_at timestamp with time zone, quickbooks_invoice_id text, quickbooks_invoice_number text, quickbooks_invoice_url text, invoice_date date, transport_net_amount numeric, timing text, resolved_at timestamp with time zone, resolution_note text, had_failed_collection boolean, last_failed_collection_at timestamp with time zone)
 LANGUAGE plpgsql STABLE SET search_path TO 'public'
AS $function$
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
    rv.resolved_at, rv.note,
    (fc.last_at IS NOT NULL), fc.last_at
  FROM public.orders o
  JOIN public.order_invoice_links l ON l.order_id=o.id
  LEFT JOIN public.profiles p ON p.id=o.user_id
  LEFT JOIN public.cancelled_invoice_reviews rv ON rv.order_id=o.id AND rv.quickbooks_invoice_id=l.quickbooks_invoice_id
  LEFT JOIN LATERAL (
    SELECT max(nullif(u->>'timestamp','')::timestamptz) AS last_at
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(o.tracking_events->'shipday'->'updates')='array'
                                   THEN o.tracking_events->'shipday'->'updates' ELSE '[]'::jsonb END) u
    WHERE u->>'event'='ORDER_FAILED' AND o.shipday_pickup_id IS NOT NULL
      AND u->>'orderId' = o.shipday_pickup_id::text
  ) fc ON true
  WHERE o.status='cancelled'
  ORDER BY l.invoice_date DESC NULLS LAST;
END $function$;
GRANT EXECUTE ON FUNCTION public.cancelled_invoiced_orders() TO authenticated;