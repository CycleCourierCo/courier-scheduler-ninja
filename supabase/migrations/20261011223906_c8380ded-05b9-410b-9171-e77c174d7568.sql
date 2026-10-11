ALTER TABLE public.oauth_clients
  ADD COLUMN IF NOT EXISTS webhook_url text,
  ADD COLUMN IF NOT EXISTS webhook_events text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS webhook_secret_hash text,
  ADD COLUMN IF NOT EXISTS webhook_secret_prefix text,
  ADD COLUMN IF NOT EXISTS webhook_last_triggered_at timestamptz,
  ADD COLUMN IF NOT EXISTS webhook_last_status text,
  ADD COLUMN IF NOT EXISTS webhook_last_error text;

ALTER TABLE public.webhook_delivery_logs
  ADD COLUMN IF NOT EXISTS oauth_client_id uuid REFERENCES public.oauth_clients(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_logs_oauth_client ON public.webhook_delivery_logs(oauth_client_id);

CREATE OR REPLACE FUNCTION public.admin_set_oauth_client_webhook(
  p_client_uuid uuid, p_webhook_url text, p_events text[], p_regenerate_secret boolean DEFAULT false)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','vault'
AS $$
DECLARE
  v_secret text; v_prefix text; v_key text; v_has boolean;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can configure partner app webhooks';
  END IF;
  IF p_webhook_url IS NOT NULL AND p_webhook_url <> '' AND p_webhook_url !~* '^https://' THEN
    RAISE EXCEPTION 'Webhook address must start with https://';
  END IF;

  SELECT webhook_secret_hash IS NOT NULL INTO v_has FROM public.oauth_clients WHERE id = p_client_uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Partner app not found'; END IF;

  UPDATE public.oauth_clients
     SET webhook_url = NULLIF(trim(p_webhook_url), ''),
         webhook_events = COALESCE(p_events, '{}'),
         updated_at = now()
   WHERE id = p_client_uuid;

  IF NULLIF(trim(p_webhook_url), '') IS NOT NULL AND (p_regenerate_secret OR NOT v_has) THEN
    v_prefix := 'whp_' || substring(p_client_uuid::text from 1 for 8);
    v_secret := v_prefix || '_' || replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
    v_key := 'oauth_webhook_secret_' || p_client_uuid::text;
    DELETE FROM vault.secrets WHERE name = v_key;
    INSERT INTO vault.secrets (name, secret) VALUES (v_key, v_secret);
    UPDATE public.oauth_clients
       SET webhook_secret_hash = encode(sha256(v_secret::bytea),'hex'),
           webhook_secret_prefix = v_prefix
     WHERE id = p_client_uuid;
  END IF;

  RETURN v_secret;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_oauth_client_webhook(uuid,text,text[],boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_oauth_client_webhook(uuid,text,text[],boolean) TO authenticated;