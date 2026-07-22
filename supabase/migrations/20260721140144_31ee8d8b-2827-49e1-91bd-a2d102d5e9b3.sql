
-- 1) Extend pg_net timeout on the weekly invoice cron caller (defensive; edge fn will return 202 fast).
CREATE OR REPLACE FUNCTION public.invoke_weekly_invoice_batch()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_cron_secret TEXT;
BEGIN
  v_cron_secret := get_cron_secret();
  PERFORM net.http_post(
    url := 'https://axigtrmaxhetyfzjjdve.supabase.co/functions/v1/weekly-invoice-batch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4aWd0cm1heGhldHlmempqZHZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE3NDA4MDMsImV4cCI6MjA1NzMxNjgwM30.POm5myoyMwKjkMfYMw2gRFs-cgD7GDznv338qiadugg',
      'X-Cron-Secret', v_cron_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
END;
$function$;

-- 2) Persistent run log for the weekly invoice batch cron.
CREATE TABLE IF NOT EXISTS public.weekly_invoice_batch_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  run_completed_at TIMESTAMPTZ,
  range_start TIMESTAMPTZ,
  range_end TIMESTAMPTZ,
  range_label TEXT,
  successful_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  eligible_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running',
  error_message TEXT,
  triggered_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.weekly_invoice_batch_logs TO authenticated;
GRANT ALL ON public.weekly_invoice_batch_logs TO service_role;

ALTER TABLE public.weekly_invoice_batch_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view weekly invoice batch logs"
  ON public.weekly_invoice_batch_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::user_role));

-- 3) Persist per-customer failures alongside successes.
ALTER TABLE public.invoice_history
  ADD COLUMN IF NOT EXISTS error_message TEXT;
