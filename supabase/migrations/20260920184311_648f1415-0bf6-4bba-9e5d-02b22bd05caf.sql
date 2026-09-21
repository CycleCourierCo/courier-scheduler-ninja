-- lovable-cron-fallback-reviewed: Resend inbound webhook can silently miss emails; 5-minute reconciliation keeps customer emails from being lost
CREATE OR REPLACE FUNCTION public.invoke_cs_resend_fetch()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
DECLARE
  v_cron_secret TEXT;
BEGIN
  v_cron_secret := get_cron_secret();

  PERFORM net.http_post(
    url := 'https://axigtrmaxhetyfzjjdve.supabase.co/functions/v1/cs-resend-fetch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', COALESCE(v_cron_secret, '')
    ),
    body := jsonb_build_object('source', 'cron', 'time', now())
  );
END;
$func$;

REVOKE ALL ON FUNCTION public.invoke_cs_resend_fetch() FROM public;
REVOKE ALL ON FUNCTION public.invoke_cs_resend_fetch() FROM anon;
REVOKE ALL ON FUNCTION public.invoke_cs_resend_fetch() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.invoke_cs_resend_fetch() TO service_role;

DO $$
BEGIN
  PERFORM cron.unschedule('cs-resend-fetch-every-5-min');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'cs-resend-fetch-every-5-min',
  '*/5 * * * *',
  $$ SELECT public.invoke_cs_resend_fetch(); $$
);