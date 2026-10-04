CREATE TABLE public.order_invoice_exclusions (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT 'Not to be invoiced',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.order_invoice_exclusions TO authenticated;
GRANT ALL ON public.order_invoice_exclusions TO service_role;
ALTER TABLE public.order_invoice_exclusions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage invoice exclusions" ON public.order_invoice_exclusions FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u WHERE public.has_role(u.uid,'admin') OR public.has_role(u.uid,'cs_agent')))
WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u WHERE public.has_role(u.uid,'admin') OR public.has_role(u.uid,'cs_agent')));

CREATE TABLE public.quickbooks_unmatched_invoices (
  quickbooks_invoice_id text PRIMARY KEY,
  invoice_number text,
  customer_name text,
  invoice_date date,
  total_amount numeric,
  synced_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.quickbooks_unmatched_invoices TO authenticated;
GRANT ALL ON public.quickbooks_unmatched_invoices TO service_role;
ALTER TABLE public.quickbooks_unmatched_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read unmatched invoices" ON public.quickbooks_unmatched_invoices FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u WHERE public.has_role(u.uid,'admin') OR public.has_role(u.uid,'cs_agent')));

ALTER TABLE public.order_invoice_links DROP CONSTRAINT order_invoice_links_link_source_check;
ALTER TABLE public.order_invoice_links ADD CONSTRAINT order_invoice_links_link_source_check CHECK (link_source IN ('invoice_creation','quickbooks_sync','manual'));

CREATE OR REPLACE FUNCTION public.unlinked_invoice_summary()
 RETURNS TABLE(unlinked_count bigint, earliest_date date, latest_date date)
 LANGUAGE plpgsql STABLE SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is not null and not (
    exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role in ('admin','cs_agent'))
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','cs_agent'))
  ) then raise exception 'Admin or customer service access required'; end if;
  return query
  select count(*)::bigint, min(o.created_at)::date, max(o.created_at)::date
  from public.orders o
  where o.order_delivered = true
    and not exists (select 1 from public.order_invoice_links l where l.order_id = o.id)
    and not exists (select 1 from public.order_invoice_exclusions e where e.order_id = o.id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.unlinked_invoice_orders()
 RETURNS TABLE(order_id uuid, tracking_number text, customer_name text, customer_id uuid, created_at timestamptz, bikes jsonb, bike_type text, bike_quantity integer, is_b2b boolean, paid_by_card boolean)
 LANGUAGE plpgsql STABLE SET search_path TO 'public'
AS $function$
begin
  if not (
    exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role in ('admin','cs_agent'))
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','cs_agent'))
  ) then raise exception 'Admin or customer service access required'; end if;
  return query
  select o.id, o.tracking_number, coalesce(nullif(p.company_name,''), p.name, o.sender->>'name'), o.user_id, o.created_at,
    o.bikes, o.bike_type, o.bike_quantity, (p.role::text = 'b2b_customer'), (o.payment_collection_phone is not null)
  from public.orders o
  left join public.profiles p on p.id = o.user_id
  where o.order_delivered = true
    and not exists (select 1 from public.order_invoice_links l where l.order_id = o.id)
    and not exists (select 1 from public.order_invoice_exclusions e where e.order_id = o.id)
  order by o.created_at desc;
end;
$function$;
GRANT EXECUTE ON FUNCTION public.unlinked_invoice_orders() TO authenticated;