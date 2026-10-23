CREATE OR REPLACE FUNCTION public.cs_update_order_item_extras(p_order_id uuid, p_is_ebay boolean, p_collection_code text, p_customer_order_number text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_old record;
  v_name text;
  v_code text := NULLIF(btrim(COALESCE(p_collection_code,'')), '');
  v_ref text := NULLIF(btrim(COALESCE(p_customer_order_number,'')), '');
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF NOT (has_role(v_uid,'admin'::user_role) OR has_role(v_uid,'cs_agent'::user_role)) THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;
  IF length(v_code) > 100 OR length(v_ref) > 100 THEN RAISE EXCEPTION 'Value too long'; END IF;
  SELECT is_ebay_order, collection_code, customer_order_number INTO v_old FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF NOT COALESCE(p_is_ebay,false) THEN v_code := NULL; END IF;
  UPDATE public.orders SET is_ebay_order = COALESCE(p_is_ebay,false), collection_code = v_code,
    customer_order_number = v_ref, updated_at = now() WHERE id = p_order_id;
  SELECT COALESCE(NULLIF(btrim(COALESCE(name,'')),''), email, 'Staff') INTO v_name FROM public.profiles WHERE id = v_uid;
  INSERT INTO public.order_comments (order_id, admin_id, admin_name, comment)
  VALUES (p_order_id, v_uid, COALESCE(v_name,'Staff'),
    'Order details updated. eBay: ' || COALESCE(v_old.is_ebay_order::text,'false') || ' → ' || COALESCE(p_is_ebay,false)::text
    || ', collection code: ' || COALESCE(v_old.collection_code,'none') || ' → ' || COALESCE(v_code,'none')
    || ', order #: ' || COALESCE(v_old.customer_order_number,'none') || ' → ' || COALESCE(v_ref,'none'));
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.cs_update_order_item_extras(uuid, boolean, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cs_update_order_item_extras(uuid, boolean, text, text) TO authenticated;