ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS misallocated_at timestamptz,
  ADD COLUMN IF NOT EXISTS misallocated_from text,
  ADD COLUMN IF NOT EXISTS misallocated_by uuid,
  ADD COLUMN IF NOT EXISTS misallocated_by_name text;

-- Stamp who allocated each new bay entry, and clear the wrongly-allocated flag once re-bayed
CREATE OR REPLACE FUNCTION public.orders_stamp_bay_allocator()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_name text; v_out jsonb := '[]'::jsonb; e jsonb;
BEGIN
  IF NEW.storage_locations IS NOT DISTINCT FROM OLD.storage_locations THEN RETURN NEW; END IF;
  IF jsonb_typeof(NEW.storage_locations) = 'array' AND jsonb_array_length(NEW.storage_locations) > 0 THEN
    IF v_uid IS NOT NULL THEN
      SELECT NULLIF(trim(coalesce(name, '')), '') INTO v_name FROM public.profiles WHERE id = v_uid;
    END IF;
    FOR e IN SELECT * FROM jsonb_array_elements(NEW.storage_locations) LOOP
      IF jsonb_typeof(e) = 'object' AND NOT (e ? 'allocatedBy') AND v_uid IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(OLD.storage_locations)='array' THEN OLD.storage_locations ELSE '[]'::jsonb END) o
                          WHERE o->>'id' = e->>'id' AND o->>'bay' IS NOT DISTINCT FROM e->>'bay' AND o->>'position' IS NOT DISTINCT FROM e->>'position') THEN
        e := e || jsonb_build_object('allocatedBy', v_uid, 'allocatedByName', v_name, 'allocatedAt', coalesce(e->>'allocatedAt', now()::text));
      END IF;
      v_out := v_out || jsonb_build_array(e);
    END LOOP;
    NEW.storage_locations := v_out;
    NEW.misallocated_at := NULL; NEW.misallocated_from := NULL; NEW.misallocated_by := NULL; NEW.misallocated_by_name := NULL;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.orders_stamp_bay_allocator() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_orders_stamp_bay_allocator ON public.orders;
CREATE TRIGGER trg_orders_stamp_bay_allocator BEFORE UPDATE OF storage_locations ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_stamp_bay_allocator();

-- Remove whatever bike the system thinks is in a bay slot and move it to "wrongly allocated"
CREATE OR REPLACE FUNCTION public.override_bay_slot(p_order_id uuid, p_bay text, p_pos int)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_bay text := upper(trim(p_bay)); v_name text; v_n int := 0; r record;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_uid
       AND role::text IN ('admin','loader','route_planner','driver','customer_service','mechanic')) THEN
    RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501';
  END IF;
  IF v_bay IS NULL OR v_bay = '' OR length(v_bay) > 10 OR p_pos IS NULL THEN RAISE EXCEPTION 'Bay required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('bay:' || v_bay || ':' || p_pos, 0));
  SELECT NULLIF(trim(coalesce(name,'')),'') INTO v_name FROM public.profiles WHERE id = v_uid;
  FOR r IN
    SELECT o.id, o.storage_locations FROM public.orders o
     WHERE jsonb_typeof(o.storage_locations) = 'array' AND o.id <> p_order_id
       AND EXISTS (SELECT 1 FROM jsonb_array_elements(o.storage_locations) l
                    WHERE upper(l->>'bay') = v_bay AND (l->>'position') ~ '^\d+$' AND (l->>'position')::int = p_pos)
     FOR UPDATE
  LOOP
    UPDATE public.orders SET
      storage_locations = NULLIF((SELECT coalesce(jsonb_agg(l), '[]'::jsonb) FROM jsonb_array_elements(r.storage_locations) l
                            WHERE NOT (upper(l->>'bay') = v_bay AND (l->>'position') ~ '^\d+$' AND (l->>'position')::int = p_pos)), '[]'::jsonb),
      updated_at = now()
     WHERE id = r.id;
    -- set after (trigger clears flags only when bays remain)
    UPDATE public.orders SET misallocated_at = now(), misallocated_from = v_bay || p_pos,
           misallocated_by = v_uid, misallocated_by_name = v_name
     WHERE id = r.id;
    INSERT INTO public.label_scans(order_id, user_id, role, action, detail)
      VALUES (r.id, v_uid, public._label_staff_role(v_uid), 'bay_override', v_bay || '-' || p_pos);
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END $$;
REVOKE EXECUTE ON FUNCTION public.override_bay_slot(uuid, text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.override_bay_slot(uuid, text, int) TO authenticated;

-- Staff clear a wrongly-allocated bike once found / dealt with
CREATE OR REPLACE FUNCTION public.dismiss_misallocated(p_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()
       AND role::text IN ('admin','loader','route_planner','driver','customer_service','mechanic')) THEN
    RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501';
  END IF;
  UPDATE public.orders SET misallocated_at = NULL, misallocated_from = NULL, misallocated_by = NULL, misallocated_by_name = NULL WHERE id = p_order_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.dismiss_misallocated(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dismiss_misallocated(uuid) TO authenticated;