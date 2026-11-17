CREATE OR REPLACE FUNCTION public.my_overdue_invoices()
RETURNS TABLE(doc_number text, due_date date, balance numeric, days_overdue integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT q.doc_number, q.due_date::date, q.balance,
    ((now() AT TIME ZONE 'Europe/London')::date - q.due_date::date)::int
  FROM public.quickbooks_invoice_status q
  JOIN public.profiles p ON p.id = (SELECT auth.uid())
  WHERE p.quickbooks_customer_id IS NOT NULL
    AND q.qb_customer_id = p.quickbooks_customer_id
    AND q.deleted = false AND q.balance > 0
    AND q.due_date::date < (now() AT TIME ZONE 'Europe/London')::date
  ORDER BY q.due_date;
$$;
REVOKE EXECUTE ON FUNCTION public.my_overdue_invoices() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_overdue_invoices() TO authenticated;