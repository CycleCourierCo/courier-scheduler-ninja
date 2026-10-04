CREATE OR REPLACE FUNCTION public.invoice_check_cutoff()
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select case when auth.uid() is null
    or exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role in ('admin','cs_agent'))
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','cs_agent'))
  then coalesce((select max(range_end) from public.weekly_invoice_batch_logs where status = 'completed'), now())
  else null end;
$$;