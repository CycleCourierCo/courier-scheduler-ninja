create or replace function public.unlinked_invoice_summary()
returns table (unlinked_count bigint, earliest_date date, latest_date date)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (
    exists (
      select 1 from public.user_roles r
      where r.user_id = auth.uid() and r.role in ('admin', 'cs_agent')
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'cs_agent')
    )
  ) then
    raise exception 'Admin or customer service access required';
  end if;

  return query
  select
    count(*)::bigint,
    min(o.created_at)::date,
    max(o.created_at)::date
  from public.orders o
  where o.order_delivered = true
    and not exists (
      select 1 from public.order_invoice_links l where l.order_id = o.id
    );
end;
$$;