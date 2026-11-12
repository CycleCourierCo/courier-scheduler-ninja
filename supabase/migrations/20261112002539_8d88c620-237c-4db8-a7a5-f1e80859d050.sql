CREATE OR REPLACE FUNCTION public.label_scan_action(p_order_id uuid, p_action text, p_detail text DEFAULT NULL::text, p_lat double precision DEFAULT NULL::double precision, p_lon double precision DEFAULT NULL::double precision)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_role text; v_n int; v_bay text; v_pos int; v_detail text; v_log_detail text := p_detail;
        v_locs jsonb; v_qty int; v_idx int; v_oldest jsonb; v_entry jsonb;
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
    v_detail := upper(regexp_replace(btrim(p_detail), '^CCCBAY:', '', 'i'));
    v_detail := regexp_replace(v_detail, '\s+', '', 'g');
    IF v_detail ~ '^[A-Z]+-?[0-9]{1,3}$' THEN
      v_bay := substring(v_detail from '^([A-Z]+)');
      v_pos := substring(v_detail from '([0-9]+)$')::int;
    ELSIF v_detail ~ '^[A-Z0-9]{1,8}-[0-9]{1,3}$' THEN
      v_bay := split_part(v_detail, '-', 1);
      v_pos := split_part(v_detail, '-', 2)::int;
    ELSIF v_detail ~ '^[A-Z0-9]{1,8}$' THEN
      v_bay := v_detail;
      v_pos := NULL;
    ELSE
      RAISE EXCEPTION 'Bay code not recognised' USING ERRCODE = 'P0001';
    END IF;
    IF v_pos IS NOT NULL AND v_pos < 1 THEN RAISE EXCEPTION 'Bay code not recognised' USING ERRCODE = 'P0001'; END IF;
    v_log_detail := v_bay || COALESCE('-' || v_pos::text, '');
    IF v_pos IS NOT NULL THEN
      PERFORM pg_advisory_xact_lock(hashtextextended('bay:' || v_bay || ':' || v_pos, 0));
      IF EXISTS (
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
    END IF;

    -- Moving a bike: lock the order and work out which existing allocation (if any) this scan replaces.
    SELECT CASE WHEN jsonb_typeof(storage_locations) = 'array' THEN storage_locations ELSE '[]'::jsonb END,
           GREATEST(COALESCE(bike_quantity, 1), 1)
      INTO v_locs, v_qty
      FROM public.orders WHERE id = p_order_id AND status NOT IN ('cancelled','delivered') FOR UPDATE;
    IF NOT FOUND THEN RETURN false; END IF;

    -- Drop any existing entry for this exact slot so a re-scan never duplicates it.
    SELECT coalesce(jsonb_agg(l), '[]'::jsonb) INTO v_locs FROM jsonb_array_elements(v_locs) l
     WHERE NOT (upper(l->>'bay') = v_bay AND COALESCE(l->>'position','') = COALESCE(v_pos::text,''));

    IF v_qty <= 1 THEN
      -- Single bike: the new bay replaces wherever it was before.
      v_locs := '[]'::jsonb;
      v_idx := 0;
    ELSIF jsonb_array_length(v_locs) >= v_qty THEN
      -- Every bike already has a bay: move the longest-stored one and keep its bike number.
      SELECT l INTO v_oldest FROM jsonb_array_elements(v_locs) l ORDER BY l->>'allocatedAt' NULLS FIRST LIMIT 1;
      v_idx := COALESCE(NULLIF(v_oldest->>'bikeIndex','')::int, 0);
      SELECT coalesce(jsonb_agg(l), '[]'::jsonb) INTO v_locs FROM jsonb_array_elements(v_locs) l WHERE l->>'id' IS DISTINCT FROM v_oldest->>'id';
    ELSE
      -- Next unallocated bike number.
      SELECT min(g) INTO v_idx FROM generate_series(0, v_qty - 1) g
       WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_locs) l WHERE (l->>'bikeIndex') ~ '^\d+$' AND (l->>'bikeIndex')::int = g);
      v_idx := COALESCE(v_idx, jsonb_array_length(v_locs));
    END IF;

    UPDATE public.orders SET storage_locations = v_locs
        || jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'orderId', id, 'bay', v_bay,
             'position', v_pos, 'bikeIndex', v_idx, 'allocatedAt', now(), 'customerName', sender->>'name')),
        loaded_onto_van = false, held_by_driver_name = NULL, held_by_driver_at = NULL, updated_at = now()
     WHERE id = p_order_id AND status NOT IN ('cancelled','delivered');
  ELSE RAISE EXCEPTION 'Unknown action';
  END IF;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN RETURN false; END IF;
  INSERT INTO public.label_scans(order_id, user_id, role, action, detail, lat, lon) VALUES (p_order_id, v_uid, v_role, p_action, v_log_detail, p_lat, p_lon);
  RETURN true;
END $function$;

REVOKE EXECUTE ON FUNCTION public.label_scan_action(uuid, text, text, double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.label_scan_action(uuid, text, text, double precision, double precision) TO authenticated, service_role;

-- Clean up the bike that ended up in both C4 and A4: keep only A4.
UPDATE public.orders
   SET storage_locations = (SELECT coalesce(jsonb_agg(l), '[]'::jsonb) FROM jsonb_array_elements(storage_locations) l
                             WHERE NOT (upper(l->>'bay') = 'C' AND l->>'position' = '4')),
       updated_at = now()
 WHERE id = '73876da6-65bb-4352-81cb-4fe264a4e87f'
   AND jsonb_typeof(storage_locations) = 'array';