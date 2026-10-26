CREATE OR REPLACE FUNCTION public.label_scan_action(p_order_id uuid, p_action text, p_detail text DEFAULT NULL, p_lat double precision DEFAULT NULL, p_lon double precision DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_role text; v_n int; v_bay text; v_pos int;
BEGIN
  v_role := public._label_staff_role(v_uid);
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_uid AND role::text IN ('admin','loader','route_planner','driver')) THEN
    RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501';
  END IF;
  IF p_action = 'load_van' THEN
    UPDATE public.orders SET loaded_onto_van = true, loaded_onto_van_at = now(), held_by_driver_name = NULL, held_by_driver_at = NULL, storage_locations = NULL, updated_at = now()
     WHERE id = p_order_id AND status NOT IN ('cancelled','delivered');
  ELSIF p_action = 'unload' THEN
    UPDATE public.orders SET loaded_onto_van = false, loaded_onto_van_at = NULL, updated_at = now() WHERE id = p_order_id;
  ELSIF p_action = 'bay' THEN
    IF p_detail IS NULL OR length(p_detail) > 40 THEN RAISE EXCEPTION 'Bay required'; END IF;
    v_bay := upper(split_part(p_detail, '-', 1));
    v_pos := NULLIF(split_part(p_detail, '-', 2), '')::int;
    IF v_pos IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.orders o, jsonb_array_elements(o.storage_locations) loc
       WHERE jsonb_typeof(o.storage_locations) = 'array'
         AND o.id <> p_order_id
         AND o.status NOT IN ('cancelled','delivered')
         AND COALESCE(o.loaded_onto_van, false) = false
         AND upper(loc->>'bay') = v_bay
         AND (loc->>'position') ~ '^\d+$' AND (loc->>'position')::int = v_pos
    ) THEN
      RAISE EXCEPTION 'Bay %-% is already occupied', v_bay, v_pos USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.orders SET storage_locations = COALESCE(CASE WHEN jsonb_typeof(storage_locations) = 'array' THEN storage_locations END, '[]'::jsonb)
        || jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'orderId', id, 'bay', v_bay,
             'position', v_pos, 'bikeIndex', 0, 'allocatedAt', now(), 'customerName', sender->>'name')),
        loaded_onto_van = false, held_by_driver_name = NULL, held_by_driver_at = NULL, updated_at = now()
     WHERE id = p_order_id AND status NOT IN ('cancelled','delivered');
  ELSE RAISE EXCEPTION 'Unknown action';
  END IF;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN RETURN false; END IF;
  INSERT INTO public.label_scans(order_id, user_id, role, action, detail, lat, lon) VALUES (p_order_id, v_uid, v_role, p_action, p_detail, p_lat, p_lon);
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.label_scan_action(uuid, text, text, double precision, double precision) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.label_scan_action(uuid, text, text, double precision, double precision) TO authenticated;