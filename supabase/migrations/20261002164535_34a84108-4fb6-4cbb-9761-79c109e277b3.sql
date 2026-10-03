create or replace function public.unlinked_invoice_summary()
returns table (unlinked_count bigint, earliest_date date, latest_date date)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*)::bigint,
    min(o.created_at)::date,
    max(o.created_at)::date
  from public.orders o
  where o.order_delivered = true
    and not exists (
      select 1 from public.order_invoice_links l where l.order_id = o.id
    )
$$;

revoke all on function public.unlinked_invoice_summary() from public, anon;
grant execute on function public.unlinked_invoice_summary() to authenticated;
grant all on function public.unlinked_invoice_summary() to service_role;