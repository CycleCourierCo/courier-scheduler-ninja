-- 1. Business approval gate on direct order inserts
DROP POLICY IF EXISTS "Consolidated orders INSERT policy" ON public.orders;
CREATE POLICY "Consolidated orders INSERT policy" ON public.orders
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s
          WHERE public.has_role(s.uid, 'admin'::user_role) OR public.has_role(s.uid, 'cs_agent'::user_role))
  OR (
    (SELECT auth.uid()) = user_id
    AND (
      public.has_role(auth.uid(), 'sales'::user_role)
      OR public.has_role(auth.uid(), 'route_planner'::user_role)
      OR (
        (public.has_role(auth.uid(), 'b2b_customer'::user_role) OR public.has_role(auth.uid(), 'b2c_customer'::user_role))
        AND NOT EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = (SELECT auth.uid())
            AND p.account_status::text IN ('pending','rejected','suspended')
        )
      )
    )
  )
);

-- 2. Dedicated NI partner key, separate from the public tracking id
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS ni_partner_token uuid NOT NULL DEFAULT gen_random_uuid();

DROP FUNCTION IF EXISTS public.get_ni_partner_job(uuid);
CREATE FUNCTION public.get_ni_partner_job(p_order_id uuid, p_token uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.orders;
  v_direction text;
  v_party jsonb;
BEGIN
  IF p_token IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id AND ni_partner_token = p_token;
  IF NOT FOUND OR COALESCE(v_order.is_northern_ireland, false) IS NOT TRUE THEN
    RETURN NULL;
  END IF;
  v_direction := COALESCE(v_order.ni_direction, 'outbound');
  v_party := CASE WHEN v_direction = 'inbound' THEN v_order.sender ELSE v_order.receiver END;
  RETURN jsonb_build_object(
    'id', v_order.id,
    'tracking_number', v_order.tracking_number,
    'direction', v_direction,
    'bike_brand', v_order.bike_brand,
    'bike_model', v_order.bike_model,
    'bike_quantity', v_order.bike_quantity,
    'party', jsonb_build_object('name', v_party->>'name','phone', v_party->>'phone','address', v_party->'address'),
    'bfs_number', v_order.ni_bfs_number,
    'label_url', v_order.ni_partner_label_url,
    'label_uploaded_at', v_order.ni_partner_label_uploaded_at
  );
END;
$function$;
GRANT EXECUTE ON FUNCTION public.get_ni_partner_job(uuid, uuid) TO anon, authenticated, service_role;

-- Partner writes only through the upload function (which checks the partner key)
REVOKE EXECUTE ON FUNCTION public.submit_ni_partner_details(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_ni_partner_details(uuid, text, text) TO service_role;

-- 3. Connection revoke must have a signed-in caller
CREATE OR REPLACE FUNCTION public.revoke_oauth_grant(p_grant_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not allowed to revoke this connection';
  END IF;
  SELECT user_id INTO v_owner FROM public.oauth_access_grants WHERE id = p_grant_id;
  IF v_owner IS NULL THEN
    RETURN false;
  END IF;
  IF v_owner IS DISTINCT FROM v_uid AND NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'Not allowed to revoke this connection';
  END IF;
  UPDATE public.oauth_access_grants SET revoked_at = now() WHERE id = p_grant_id AND revoked_at IS NULL;
  UPDATE public.oauth_access_tokens SET revoked_at = now() WHERE grant_id = p_grant_id AND revoked_at IS NULL;
  UPDATE public.oauth_refresh_tokens SET revoked_at = now() WHERE grant_id = p_grant_id AND revoked_at IS NULL;
  RETURN true;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.revoke_oauth_grant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_oauth_grant(uuid) TO authenticated, service_role;