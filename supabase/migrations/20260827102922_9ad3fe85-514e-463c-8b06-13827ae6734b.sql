-- Atomic, loss-free merge of Shipday references into orders.tracking_events
CREATE OR REPLACE FUNCTION public.apply_shipday_tracking(
  p_order_id uuid,
  p_pickup_id text DEFAULT NULL,
  p_delivery_id text DEFAULT NULL,
  p_event jsonb DEFAULT NULL,
  p_set_created_at boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
DECLARE
  v_shipday jsonb;
BEGIN
  SELECT COALESCE(tracking_events -> 'shipday', '{}'::jsonb)
    INTO v_shipday
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_shipday IS NULL THEN
    RETURN;
  END IF;

  IF p_pickup_id IS NOT NULL THEN
    v_shipday := jsonb_set(v_shipday, '{pickup_id}', to_jsonb(p_pickup_id), true);
  END IF;

  IF p_delivery_id IS NOT NULL THEN
    v_shipday := jsonb_set(v_shipday, '{delivery_id}', to_jsonb(p_delivery_id), true);
  END IF;

  IF p_set_created_at OR NOT (v_shipday ? 'created_at') THEN
    v_shipday := jsonb_set(v_shipday, '{created_at}', to_jsonb(now()), true);
  END IF;

  IF p_event IS NOT NULL THEN
    v_shipday := jsonb_set(
      v_shipday,
      '{updates}',
      COALESCE(v_shipday -> 'updates', '[]'::jsonb) || jsonb_build_array(p_event),
      true
    );
  END IF;

  UPDATE public.orders
  SET tracking_events = jsonb_set(COALESCE(tracking_events, '{}'::jsonb), '{shipday}', v_shipday, true),
      shipday_pickup_id = COALESCE(p_pickup_id, shipday_pickup_id),
      shipday_delivery_id = COALESCE(p_delivery_id, shipday_delivery_id),
      updated_at = now()
  WHERE id = p_order_id;
END;
$func$;

REVOKE ALL ON FUNCTION public.apply_shipday_tracking(uuid, text, text, jsonb, boolean) FROM public;
REVOKE ALL ON FUNCTION public.apply_shipday_tracking(uuid, text, text, jsonb, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.apply_shipday_tracking(uuid, text, text, jsonb, boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.apply_shipday_tracking(uuid, text, text, jsonb, boolean) TO service_role;

-- Cron wrapper: self-heal orders that never got their Shipday jobs created
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
      'X-Cron-Secret', COALESCE(v_cron_secret, '')
    ),
    body := jsonb_build_object('source', 'cron', 'time', now())
  );
END;
$func$;

REVOKE ALL ON FUNCTION public.invoke_backfill_shipday_jobs() FROM public;
REVOKE ALL ON FUNCTION public.invoke_backfill_shipday_jobs() FROM anon;
REVOKE ALL ON FUNCTION public.invoke_backfill_shipday_jobs() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.invoke_backfill_shipday_jobs() TO service_role;

DO $$
BEGIN
  PERFORM cron.unschedule('backfill-shipday-jobs-every-15-min');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'backfill-shipday-jobs-every-15-min',
  '*/15 * * * *',
  $$ SELECT public.invoke_backfill_shipday_jobs(); $$
);