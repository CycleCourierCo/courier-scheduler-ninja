-- Partner OAuth applications (staff-registered)
CREATE TABLE public.oauth_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL UNIQUE,
  client_secret_hash text NOT NULL,
  secret_prefix text NOT NULL,
  name text NOT NULL,
  logo_url text,
  contact_email text,
  redirect_uris text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.oauth_clients TO authenticated;
GRANT ALL ON public.oauth_clients TO service_role;
ALTER TABLE public.oauth_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view partner apps" ON public.oauth_clients
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) a WHERE public.has_role(a.uid, 'admin')));
CREATE POLICY "Admins can create partner apps" ON public.oauth_clients
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) a WHERE public.has_role(a.uid, 'admin')));
CREATE POLICY "Admins can update partner apps" ON public.oauth_clients
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) a WHERE public.has_role(a.uid, 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) a WHERE public.has_role(a.uid, 'admin')));
CREATE POLICY "Admins can delete partner apps" ON public.oauth_clients
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) a WHERE public.has_role(a.uid, 'admin')));

-- Customer approvals per partner app
CREATE TABLE public.oauth_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_uuid uuid NOT NULL REFERENCES public.oauth_clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  scope text NOT NULL DEFAULT 'api',
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX oauth_access_grants_active_unique
  ON public.oauth_access_grants (client_uuid, user_id) WHERE revoked_at IS NULL;

GRANT SELECT, UPDATE ON public.oauth_access_grants TO authenticated;
GRANT ALL ON public.oauth_access_grants TO service_role;
ALTER TABLE public.oauth_access_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own connections" ON public.oauth_access_grants
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) a WHERE public.has_role(a.uid, 'admin')));
CREATE POLICY "Users revoke their own connections" ON public.oauth_access_grants
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Single-use authorization codes
CREATE TABLE public.oauth_authorization_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash text NOT NULL UNIQUE,
  client_uuid uuid NOT NULL REFERENCES public.oauth_clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  redirect_uri text NOT NULL,
  code_challenge text NOT NULL,
  code_challenge_method text NOT NULL DEFAULT 'S256',
  scope text NOT NULL DEFAULT 'api',
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.oauth_authorization_codes TO service_role;
ALTER TABLE public.oauth_authorization_codes ENABLE ROW LEVEL SECURITY;

-- Access tokens (opaque, hashed)
CREATE TABLE public.oauth_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id uuid NOT NULL REFERENCES public.oauth_access_grants(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.oauth_access_tokens TO service_role;
ALTER TABLE public.oauth_access_tokens ENABLE ROW LEVEL SECURITY;

-- Refresh tokens (rotating, hashed)
CREATE TABLE public.oauth_refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id uuid NOT NULL REFERENCES public.oauth_access_grants(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  rotated_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.oauth_refresh_tokens TO service_role;
ALTER TABLE public.oauth_refresh_tokens ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_oauth_clients_updated_at BEFORE UPDATE ON public.oauth_clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_oauth_access_grants_updated_at BEFORE UPDATE ON public.oauth_access_grants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Register a partner app and return its credentials once
CREATE OR REPLACE FUNCTION public.admin_create_oauth_client(
  p_name text,
  p_redirect_uris text[],
  p_logo_url text DEFAULT NULL,
  p_contact_email text DEFAULT NULL
)
RETURNS TABLE(id uuid, client_id text, client_secret text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid := gen_random_uuid();
  v_client_id text;
  v_secret text;
  v_uri text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can register partner apps';
  END IF;

  IF p_name IS NULL OR length(btrim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Partner app name is required';
  END IF;

  IF p_redirect_uris IS NULL OR array_length(p_redirect_uris, 1) IS NULL THEN
    RAISE EXCEPTION 'At least one return web address is required';
  END IF;

  FOREACH v_uri IN ARRAY p_redirect_uris LOOP
    IF v_uri !~ '^https://' AND v_uri !~ '^http://localhost' THEN
      RAISE EXCEPTION 'Return web addresses must start with https:// (http://localhost allowed for testing)';
    END IF;
  END LOOP;

  v_client_id := 'ccapp_' || replace(gen_random_uuid()::text, '-', '');
  v_secret := 'ccsec_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.oauth_clients (id, client_id, client_secret_hash, secret_prefix, name, logo_url, contact_email, redirect_uris, created_by)
  VALUES (v_id, v_client_id, encode(sha256(v_secret::bytea), 'hex'), substring(v_secret from 1 for 14), btrim(p_name), p_logo_url, p_contact_email, p_redirect_uris, auth.uid());

  RETURN QUERY SELECT v_id, v_client_id, v_secret;
END;
$$;

-- Public (unauthenticated) details needed to render the approval screen
CREATE OR REPLACE FUNCTION public.get_oauth_client_public(p_client_id text, p_redirect_uri text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_client public.oauth_clients;
BEGIN
  SELECT * INTO v_client FROM public.oauth_clients WHERE client_id = p_client_id;

  IF v_client.id IS NULL OR v_client.is_active = false THEN
    RETURN jsonb_build_object('valid', false, 'error', 'unknown_client');
  END IF;

  IF p_redirect_uri IS NULL OR NOT (p_redirect_uri = ANY (v_client.redirect_uris)) THEN
    RETURN jsonb_build_object('valid', false, 'error', 'invalid_redirect_uri');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'name', v_client.name,
    'logo_url', v_client.logo_url,
    'contact_email', v_client.contact_email
  );
END;
$$;

-- Resolve an API access token to its owning account
CREATE OR REPLACE FUNCTION public.verify_oauth_token(access_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_hash text := encode(sha256(access_token::bytea), 'hex');
  v_user_id uuid;
  v_grant_id uuid;
BEGIN
  SELECT g.user_id, g.id INTO v_user_id, v_grant_id
  FROM public.oauth_access_tokens t
  JOIN public.oauth_access_grants g ON g.id = t.grant_id
  JOIN public.oauth_clients c ON c.id = g.client_uuid
  WHERE t.token_hash = v_hash
    AND t.revoked_at IS NULL
    AND t.expires_at > now()
    AND g.revoked_at IS NULL
    AND c.is_active = true;

  IF v_grant_id IS NOT NULL THEN
    UPDATE public.oauth_access_grants SET last_used_at = now() WHERE id = v_grant_id;
  END IF;

  RETURN v_user_id;
END;
$$;

-- A customer's connected partner apps
CREATE OR REPLACE FUNCTION public.get_my_connected_apps()
RETURNS TABLE(grant_id uuid, app_name text, logo_url text, connected_at timestamptz, last_used_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT g.id, c.name, c.logo_url, g.created_at, g.last_used_at
  FROM public.oauth_access_grants g
  JOIN public.oauth_clients c ON c.id = g.client_uuid
  WHERE g.user_id = auth.uid()
    AND g.revoked_at IS NULL
  ORDER BY g.created_at DESC;
$$;

-- Customer revokes one connection
CREATE OR REPLACE FUNCTION public.revoke_oauth_grant(p_grant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_owner uuid;
BEGIN
  SELECT user_id INTO v_owner FROM public.oauth_access_grants WHERE id = p_grant_id;
  IF v_owner IS NULL THEN
    RETURN false;
  END IF;
  IF v_owner <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not allowed to revoke this connection';
  END IF;

  UPDATE public.oauth_access_grants SET revoked_at = now() WHERE id = p_grant_id AND revoked_at IS NULL;
  UPDATE public.oauth_access_tokens SET revoked_at = now() WHERE grant_id = p_grant_id AND revoked_at IS NULL;
  UPDATE public.oauth_refresh_tokens SET revoked_at = now() WHERE grant_id = p_grant_id AND revoked_at IS NULL;
  RETURN true;
END;
$$;

-- Housekeeping for expired codes and tokens
CREATE OR REPLACE FUNCTION public.cleanup_expired_oauth()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  DELETE FROM public.oauth_authorization_codes WHERE expires_at < now() - interval '1 day';
  DELETE FROM public.oauth_access_tokens WHERE expires_at < now() - interval '7 days';
  DELETE FROM public.oauth_refresh_tokens WHERE expires_at < now() - interval '30 days';
$$;

REVOKE ALL ON FUNCTION public.admin_create_oauth_client(text, text[], text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_create_oauth_client(text, text[], text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_oauth_client_public(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_connected_apps() TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_oauth_grant(uuid) TO authenticated;