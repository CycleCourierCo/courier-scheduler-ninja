CREATE TABLE public.fleet_integration_tokens (
  provider text PRIMARY KEY,
  token text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.fleet_integration_tokens TO service_role;
REVOKE ALL ON public.fleet_integration_tokens FROM anon, authenticated;
ALTER TABLE public.fleet_integration_tokens ENABLE ROW LEVEL SECURITY;

SELECT cron.schedule('radius-token-keepalive', '15 6 * * *', $$
  SELECT net.http_post(
    url := 'https://axigtrmaxhetyfzjjdve.supabase.co/functions/v1/radius-positions',
    headers := jsonb_build_object('Content-Type','application/json','X-Cron-Secret', public.get_cron_secret()),
    body := '{"action":"keepalive"}'::jsonb
  );
$$);