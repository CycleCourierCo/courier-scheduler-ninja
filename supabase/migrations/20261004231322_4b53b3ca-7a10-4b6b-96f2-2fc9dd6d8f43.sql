CREATE OR REPLACE FUNCTION public.invoice_check_cutoff()
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select coalesce((select max(range_end) from public.weekly_invoice_batch_logs where status = 'completed'), now());
$$;
REVOKE ALL ON FUNCTION public.invoice_check_cutoff() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.invoice_check_cutoff() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.unlinked_invoice_orders()
RETURNS TABLE(order_id uuid, tracking_number text, customer_name text, customer_id uuid, created_at timestamp with time zone, bikes jsonb, bike_type text, bike_quantity integer, is_b2b boolean, paid_by_card boolean)
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
    and o.created_at::date >= date '2025-09-01'
    and o.created_at < public.invoice_check_cutoff()
    and not exists (select 1 from public.order_invoice_links l where l.order_id = o.id)
    and not exists (select 1 from public.order_invoice_exclusions e where e.order_id = o.id)
    and not exists (select 1 from public.profiles sp where sp.id = o.user_id and sp.email = 'shopify@cyclecourierco.com')
  order by o.created_at desc;
end;
$function$;

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
    and o.created_at::date >= date '2025-09-01'
    and o.created_at < public.invoice_check_cutoff()
    and not exists (select 1 from public.order_invoice_links l where l.order_id = o.id)
    and not exists (select 1 from public.order_invoice_exclusions e where e.order_id = o.id)
    and not exists (select 1 from public.profiles sp where sp.id = o.user_id and sp.email = 'shopify@cyclecourierco.com');
end;
$function$;