CREATE OR REPLACE FUNCTION public.invoke_ferry_partner_notification(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_secret text;
BEGIN
  v_secret := public.get_cron_secret();
  PERFORM net.http_post(
    url := 'https://axigtrmaxhetyfzjjdve.supabase.co/functions/v1/send-ferry-partner-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', coalesce(v_secret, '')
    ),
    body := jsonb_build_object('orderId', p_order_id::text)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_ferry_partner_notification(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.invoke_ferry_partner_notification(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invoke_ferry_partner_notification(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.trg_notify_ferry_partner_on_pickup_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.is_northern_ireland, false)
     AND NEW.ni_direction = 'inbound'
     AND NEW.ferry_partner_notified_at IS NULL
     AND NEW.pickup_date IS NOT NULL
     AND jsonb_typeof(NEW.pickup_date) = 'array'
     AND jsonb_array_length(NEW.pickup_date) > 0
     AND (OLD.pickup_date IS DISTINCT FROM NEW.pickup_date)
  THEN
    BEGIN
      PERFORM public.invoke_ferry_partner_notification(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Ferry partner notification dispatch failed: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_ferry_partner_on_pickup_date ON public.orders;
CREATE TRIGGER notify_ferry_partner_on_pickup_date
AFTER UPDATE OF pickup_date ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.trg_notify_ferry_partner_on_pickup_date();