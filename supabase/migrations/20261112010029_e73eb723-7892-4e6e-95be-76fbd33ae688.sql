-- Only keep the saved bay slots that are still free (locks each slot so two people can't claim it at once).
CREATE OR REPLACE FUNCTION public._free_bay_slots(p_order_id uuid, p_locs jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_out jsonb := '[]'::jsonb; l jsonb; v_bay text; v_pos int;
BEGIN
  IF jsonb_typeof(p_locs) <> 'array' THEN RETURN '[]'::jsonb; END IF;
  FOR l IN SELECT * FROM jsonb_array_elements(p_locs) LOOP
    v_bay := upper(l->>'bay');
    v_pos := CASE WHEN (l->>'position') ~ '^\d+$' THEN (l->>'position')::int END;
    IF v_bay IS NULL THEN CONTINUE; END IF;
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
      ) THEN CONTINUE; END IF;
    END IF;
    v_out := v_out || jsonb_build_array(l);
  END LOOP;
  RETURN v_out;
END $$;
REVOKE EXECUTE ON FUNCTION public._free_bay_slots(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._free_bay_slots(uuid, jsonb) TO service_role;

-- Loading always replaces the saved bay (never keeps a stale one from an earlier trip).
CREATE OR REPLACE FUNCTION public.orders_stamp_taken_out()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF COALESCE(NEW.loaded_onto_van,false) AND NOT COALESCE(OLD.loaded_onto_van,false) THEN
    NEW.loaded_onto_van_by := v_uid;
    NEW.loaded_onto_van_by_name := (SELECT NULLIF(trim(coalesce(name,'')),'') FROM public.profiles WHERE id = v_uid);
    IF jsonb_typeof(OLD.storage_locations) = 'array' AND jsonb_array_length(OLD.storage_locations) > 0 THEN
      NEW.loaded_from_locations := OLD.storage_locations;
    ELSE
      NEW.loaded_from_locations := NULL;
    END IF;
  ELSIF NOT COALESCE(NEW.loaded_onto_van,false) AND COALESCE(OLD.loaded_onto_van,false) THEN
    NEW.loaded_onto_van_by := NULL;
    NEW.loaded_onto_van_by_name := NULL;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.orders_stamp_taken_out() FROM PUBLIC, anon, authenticated;

-- "Unload from van" on the Loading page: back into the old bay if it's still free, otherwise Pending Storage Allocation.
CREATE OR REPLACE FUNCTION public.unload_from_van(p_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_saved jsonb; v_free jsonb; v_cur jsonb;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_uid AND ur.role::text NOT IN ('b2b_customer','b2c_customer')
  ) THEN
    RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501';
  END IF;
  SELECT loaded_from_locations, storage_locations INTO v_saved, v_cur
    FROM public.orders WHERE id = p_order_id AND COALESCE(loaded_onto_van,false) = true FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false); END IF;
  v_free := public._free_bay_slots(p_order_id, v_saved);
  UPDATE public.orders
     SET loaded_onto_van = false,
         storage_locations = CASE WHEN jsonb_array_length(v_free) > 0 THEN v_free ELSE v_cur END,
         loaded_from_locations = NULL,
         updated_at = now()
   WHERE id = p_order_id;
  INSERT INTO public.label_scans(order_id, user_id, role, action, detail)
    VALUES (p_order_id, v_uid, public._label_staff_role(v_uid), 'unload',
            NULLIF((SELECT string_agg(upper(l->>'bay') || COALESCE('-' || (l->>'position'), ''), ', ') FROM jsonb_array_elements(v_free) l), ''));
  RETURN jsonb_build_object('ok', true, 'restored', v_free,
    'not_restored', GREATEST(COALESCE(jsonb_array_length(CASE WHEN jsonb_typeof(v_saved)='array' THEN v_saved END),0) - jsonb_array_length(v_free), 0));
END $$;
REVOKE EXECUTE ON FUNCTION public.unload_from_van(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unload_from_van(uuid) TO authenticated, service_role;

-- Undo in the Loaders List: same rule, never double-books a bay.
CREATE OR REPLACE FUNCTION public.undo_taken_out(p_order_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_saved jsonb; v_free jsonb;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501';
  END IF;
  SELECT loaded_from_locations INTO v_saved FROM public.orders
   WHERE id = p_order_id AND loaded_onto_van = true FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  v_free := public._free_bay_slots(p_order_id, v_saved);
  UPDATE public.orders SET loaded_onto_van = false, loaded_onto_van_at = NULL,
         storage_locations = CASE WHEN jsonb_array_length(v_free) > 0 THEN v_free END,
         loaded_from_locations = NULL, updated_at = now()
   WHERE id = p_order_id;
  INSERT INTO public.label_scans(order_id, user_id, role, action, detail)
    VALUES (p_order_id, v_uid, public._label_staff_role(v_uid), 'undo_taken_out', NULL);
  RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.undo_taken_out(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.undo_taken_out(uuid) TO authenticated, service_role;

-- Scanner "Unload to depot": same bay restore.
CREATE OR REPLACE FUNCTION public.label_scan_action(p_order_id uuid, p_action text, p_detail text DEFAULT NULL::text, p_lat double precision DEFAULT NULL::double precision, p_lon double precision DEFAULT NULL::double precision)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_role text; v_n int; v_bay text; v_pos int; v_detail text; v_log_detail text := p_detail;
        v_locs jsonb; v_qty int; v_idx int; v_oldest jsonb; v_entry jsonb; v_free jsonb;
BEGIN
  v_role := public._label_staff_role(v_uid);
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_uid AND role::text IN ('admin','loader','route_planner','driver')) THEN
    RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501';
  END IF;
  IF p_action = 'load_van' THEN
    UPDATE public.orders SET loaded_onto_van = true, loaded_onto_van_at = now(), held_by_driver_name = NULL, held_by_driver_at = NULL, storage_locations = NULL, updated_at = now()
     WHERE id = p_order_id AND status NOT IN ('cancelled','delivered');
  ELSIF p_action = 'unload' THEN
    SELECT loaded_from_locations INTO v_locs FROM public.orders
     WHERE id = p_order_id AND COALESCE(loaded_onto_van,false) = true FOR UPDATE;
    v_free := CASE WHEN FOUND THEN public._free_bay_slots(p_order_id, v_locs) ELSE '[]'::jsonb END;
    UPDATE public.orders SET loaded_onto_van = false, loaded_onto_van_at = NULL,
           storage_locations = CASE WHEN jsonb_array_length(v_free) > 0 THEN v_free ELSE storage_locations END,
           loaded_from_locations = NULL, updated_at = now()
     WHERE id = p_order_id;
    v_log_detail := NULLIF((SELECT string_agg(upper(l->>'bay') || COALESCE('-' || (l->>'position'), ''), ', ') FROM jsonb_array_elements(v_free) l), '');
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

    SELECT CASE WHEN jsonb_typeof(storage_locations) = 'array' THEN storage_locations ELSE '[]'::jsonb END,
           GREATEST(COALESCE(bike_quantity, 1), 1)
      INTO v_locs, v_qty
      FROM public.orders WHERE id = p_order_id AND status NOT IN ('cancelled','delivered') FOR UPDATE;
    IF NOT FOUND THEN RETURN false; END IF;

    SELECT coalesce(jsonb_agg(l), '[]'::jsonb) INTO v_locs FROM jsonb_array_elements(v_locs) l
     WHERE NOT (upper(l->>'bay') = v_bay AND COALESCE(l->>'position','') = COALESCE(v_pos::text,''));

    IF v_qty <= 1 THEN
      v_locs := '[]'::jsonb;
      v_idx := 0;
    ELSIF jsonb_array_length(v_locs) >= v_qty THEN
      SELECT l INTO v_oldest FROM jsonb_array_elements(v_locs) l ORDER BY l->>'allocatedAt' NULLS FIRST LIMIT 1;
      v_idx := COALESCE(NULLIF(v_oldest->>'bikeIndex','')::int, 0);
      SELECT coalesce(jsonb_agg(l), '[]'::jsonb) INTO v_locs FROM jsonb_array_elements(v_locs) l WHERE l->>'id' IS DISTINCT FROM v_oldest->>'id';
    ELSE
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