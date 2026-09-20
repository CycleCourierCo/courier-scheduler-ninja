CREATE OR REPLACE FUNCTION public.resolve_oauth_token_grant(access_token text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT g.id
  FROM public.oauth_access_tokens t
  JOIN public.oauth_access_grants g ON g.id = t.grant_id
  JOIN public.oauth_clients c ON c.id = g.client_uuid
  WHERE t.token_hash = encode(sha256(access_token::bytea), 'hex')
    AND t.revoked_at IS NULL
    AND t.expires_at > now()
    AND g.revoked_at IS NULL
    AND c.is_active = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_oauth_token_grant(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_oauth_token_grant(text) FROM anon;
REVOKE ALL ON FUNCTION public.resolve_oauth_token_grant(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_oauth_token_grant(text) TO service_role;