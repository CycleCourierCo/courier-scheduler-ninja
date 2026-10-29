CREATE OR REPLACE FUNCTION public.get_ni_partner_job(p_order_id uuid, p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
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
    'ferry_region', COALESCE(v_order.ferry_region, 'northern_ireland'),
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