-- Wrapper that the cron job calls
CREATE OR REPLACE FUNCTION public.invoke_refresh_vehicles()
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
    url := 'https://axigtrmaxhetyfzjjdve.supabase.co/functions/v1/refresh-vehicles',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4aWd0cm1heGhldHlmempqZHZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE3NDA4MDMsImV4cCI6MjA1NzMxNjgwM30.POm5myoyMwKjkMfYMw2gRFs-cgD7GDznv338qiadugg',
      'X-Cron-Secret', v_cron_secret
    ),
    body := '{}'::jsonb
  );
END;
$func$;

-- Unschedule existing job if present, then schedule daily at 03:00 UTC
DO $$
BEGIN
  PERFORM cron.unschedule('refresh-vehicles-daily');
EXCEPTION WHEN OTHERS THEN
  -- ignore if it doesn't exist
  NULL;
END $$;

SELECT cron.schedule(
  'refresh-vehicles-daily',
  '0 3 * * *',
  $$ SELECT public.invoke_refresh_vehicles(); $$
);