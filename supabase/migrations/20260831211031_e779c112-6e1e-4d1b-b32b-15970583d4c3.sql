CREATE OR REPLACE FUNCTION public.queue_new_order_shipday_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cron_secret text;
  v_publishable_key constant text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4aWd0cm1heGhldHlmempqZHZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE3NDA4MDMsImV4cCI6MjA1NzMxNjgwM30.POm5myoyMwKjkMfYMw2gRFs-cgD7GDznv338qiadugg';
BEGIN
  v_cron_secret := public.get_cron_secret();

  IF v_cron_secret IS NULL OR v_cron_secret = '' THEN
    RAISE WARNING 'Shipday order sync was not queued because the cron secret is unavailable';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://axigtrmaxhetyfzjjdve.supabase.co/functions/v1/sync-order-shipday',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', v_publishable_key,
      'Authorization', 'Bearer ' || v_publishable_key,
      'X-Cron-Secret', v_cron_secret
    ),
    body := jsonb_build_object('orderId', NEW.id, 'source', 'order_insert'),
    timeout_milliseconds := 30000
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Shipday order sync could not be queued';
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.queue_new_order_shipday_sync() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_new_order_shipday_sync() TO service_role;

DROP TRIGGER IF EXISTS trg_queue_new_order_shipday_sync ON public.orders;
CREATE TRIGGER trg_queue_new_order_shipday_sync
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.queue_new_order_shipday_sync();