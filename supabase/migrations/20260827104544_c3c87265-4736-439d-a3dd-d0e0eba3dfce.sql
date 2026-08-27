CREATE OR REPLACE FUNCTION public.invoke_backfill_shipday_jobs()
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
    url := 'https://axigtrmaxhetyfzjjdve.supabase.co/functions/v1/backfill-shipday-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4aWd0cm1heGhldHlmempqZHZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE3NDA4MDMsImV4cCI6MjA1NzMxNjgwM30.POm5myoyMwKjkMfYMw2gRFs-cgD7GDznv338qiadugg',
      'X-Cron-Secret', COALESCE(v_cron_secret, '')
    ),
    body := jsonb_build_object('source', 'cron', 'days', 30)
  );
END;
$func$;

REVOKE ALL ON FUNCTION public.invoke_backfill_shipday_jobs() FROM public;
REVOKE ALL ON FUNCTION public.invoke_backfill_shipday_jobs() FROM anon;
REVOKE ALL ON FUNCTION public.invoke_backfill_shipday_jobs() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.invoke_backfill_shipday_jobs() TO service_role;

SELECT public.invoke_backfill_shipday_jobs();