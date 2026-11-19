CREATE TABLE public.quickbooks_invoice_status (
  quickbooks_invoice_id text PRIMARY KEY,
  doc_number text,
  customer_name text,
  qb_customer_id text,
  txn_date date,
  due_date date,
  total_amount numeric NOT NULL DEFAULT 0,
  balance numeric NOT NULL DEFAULT 0,
  deleted boolean NOT NULL DEFAULT false,
  checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.quickbooks_invoice_status TO authenticated;
GRANT ALL ON public.quickbooks_invoice_status TO service_role;
ALTER TABLE public.quickbooks_invoice_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin and CS can view QuickBooks invoice status"
  ON public.quickbooks_invoice_status FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE public.has_role(s.uid, 'admin'::user_role) OR public.has_role(s.uid, 'cs_agent'::user_role)));

CREATE INDEX quickbooks_invoice_status_open_idx ON public.quickbooks_invoice_status (due_date) WHERE balance > 0 AND deleted = false;
CREATE INDEX quickbooks_invoice_status_checked_idx ON public.quickbooks_invoice_status (checked_at DESC);

CREATE TRIGGER update_quickbooks_invoice_status_updated_at
  BEFORE UPDATE ON public.quickbooks_invoice_status
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.invoke_invoice_payment_sync()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s text;
BEGIN
  s := get_cron_secret();
  PERFORM net.http_post(
    url := 'https://axigtrmaxhetyfzjjdve.supabase.co/functions/v1/sync-invoice-payment-status',
    headers := jsonb_build_object('Content-Type','application/json','X-Cron-Secret', s),
    body := '{}'::jsonb
  );
END; $$;
REVOKE ALL ON FUNCTION public.invoke_invoice_payment_sync() FROM PUBLIC, anon, authenticated;

-- 06:30 UTC daily, plus 13:30 so afternoon payments show the same day.
SELECT cron.schedule('invoice-payment-sync', '30 6,13 * * *', $$SELECT public.invoke_invoice_payment_sync();$$);