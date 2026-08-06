CREATE OR REPLACE FUNCTION public.invoke_send_order_updates()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret text;
BEGIN
  v_secret := public.get_cron_secret();
  PERFORM net.http_post(
    url := 'https://axigtrmaxhetyfzjjdve.supabase.co/functions/v1/send-order-updates',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', coalesce(v_secret, '')
    ),
    body := jsonb_build_object('source', 'cron', 'time', now())
  );
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_send_order_updates() FROM public;
GRANT EXECUTE ON FUNCTION public.invoke_send_order_updates() TO service_role;