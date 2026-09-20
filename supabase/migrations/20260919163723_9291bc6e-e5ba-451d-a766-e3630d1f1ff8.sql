CREATE TABLE public.oauth_grant_addresses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grant_id uuid NOT NULL UNIQUE REFERENCES public.oauth_access_grants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  contact_name text,
  contact_phone text,
  address_line_1 text NOT NULL,
  address_line_2 text,
  city text NOT NULL,
  county text,
  postcode text NOT NULL,
  country text NOT NULL DEFAULT 'United Kingdom',
  lat numeric,
  lon numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.oauth_grant_addresses TO authenticated;
GRANT ALL ON public.oauth_grant_addresses TO service_role;

ALTER TABLE public.oauth_grant_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their connected app addresses"
ON public.oauth_grant_addresses FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Owners can add their connected app addresses"
ON public.oauth_grant_addresses FOR INSERT TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.oauth_access_grants g
    WHERE g.id = grant_id AND g.user_id = (SELECT auth.uid()) AND g.revoked_at IS NULL
  )
);

CREATE POLICY "Owners can update their connected app addresses"
ON public.oauth_grant_addresses FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.oauth_access_grants g
    WHERE g.id = grant_id AND g.user_id = (SELECT auth.uid()) AND g.revoked_at IS NULL
  )
);

CREATE POLICY "Owners can delete their connected app addresses"
ON public.oauth_grant_addresses FOR DELETE TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE TRIGGER update_oauth_grant_addresses_updated_at
BEFORE UPDATE ON public.oauth_grant_addresses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP FUNCTION IF EXISTS public.get_my_connected_apps();

CREATE FUNCTION public.get_my_connected_apps()
RETURNS TABLE(
  grant_id uuid,
  app_name text,
  logo_url text,
  connected_at timestamptz,
  last_used_at timestamptz,
  address jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT g.id, c.name, c.logo_url, g.created_at, g.last_used_at,
    CASE WHEN a.id IS NULL THEN NULL ELSE jsonb_build_object(
      'contact_name', a.contact_name,
      'contact_phone', a.contact_phone,
      'address_line_1', a.address_line_1,
      'address_line_2', a.address_line_2,
      'city', a.city,
      'county', a.county,
      'postcode', a.postcode,
      'country', a.country
    ) END
  FROM public.oauth_access_grants g
  JOIN public.oauth_clients c ON c.id = g.client_uuid
  LEFT JOIN public.oauth_grant_addresses a ON a.grant_id = g.id
  WHERE g.user_id = auth.uid()
    AND g.revoked_at IS NULL
  ORDER BY g.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_connected_apps() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_my_connected_app_address(p_grant_id uuid, p_address jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_owner uuid;
BEGIN
  SELECT user_id INTO v_owner
  FROM public.oauth_access_grants
  WHERE id = p_grant_id AND revoked_at IS NULL;

  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Not allowed to change this connection';
  END IF;

  IF p_address IS NULL OR p_address = 'null'::jsonb THEN
    DELETE FROM public.oauth_grant_addresses WHERE grant_id = p_grant_id;
    RETURN true;
  END IF;

  IF coalesce(btrim(p_address->>'address_line_1'), '') = ''
     OR coalesce(btrim(p_address->>'city'), '') = ''
     OR coalesce(btrim(p_address->>'postcode'), '') = '' THEN
    RAISE EXCEPTION 'Address line 1, city and postcode are required';
  END IF;

  INSERT INTO public.oauth_grant_addresses AS a (
    grant_id, user_id, contact_name, contact_phone,
    address_line_1, address_line_2, city, county, postcode, country
  ) VALUES (
    p_grant_id, v_owner,
    nullif(btrim(coalesce(p_address->>'contact_name', '')), ''),
    nullif(btrim(coalesce(p_address->>'contact_phone', '')), ''),
    btrim(p_address->>'address_line_1'),
    nullif(btrim(coalesce(p_address->>'address_line_2', '')), ''),
    btrim(p_address->>'city'),
    nullif(btrim(coalesce(p_address->>'county', '')), ''),
    btrim(p_address->>'postcode'),
    coalesce(nullif(btrim(coalesce(p_address->>'country', '')), ''), 'United Kingdom')
  )
  ON CONFLICT (grant_id) DO UPDATE SET
    contact_name = EXCLUDED.contact_name,
    contact_phone = EXCLUDED.contact_phone,
    address_line_1 = EXCLUDED.address_line_1,
    address_line_2 = EXCLUDED.address_line_2,
    city = EXCLUDED.city,
    county = EXCLUDED.county,
    postcode = EXCLUDED.postcode,
    country = EXCLUDED.country,
    lat = NULL,
    lon = NULL,
    updated_at = now();

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_my_connected_app_address(uuid, jsonb) TO authenticated;