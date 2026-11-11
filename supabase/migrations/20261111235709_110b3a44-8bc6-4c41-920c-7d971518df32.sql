ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS misallocated_original_by_name text,
  ADD COLUMN IF NOT EXISTS misallocated_original_at timestamptz;

CREATE OR REPLACE FUNCTION public.override_bay_slot(p_order_id uuid, p_bay text, p_pos int)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_bay text := upper(trim(p_bay)); v_name text; v_n int := 0; r record;
        v_orig jsonb; v_orig_name text; v_orig_at timestamptz;
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
    SELECT l INTO v_orig FROM jsonb_array_elements(r.storage_locations) l
     WHERE upper(l->>'bay') = v_bay AND (l->>'position') ~ '^\d+$' AND (l->>'position')::int = p_pos LIMIT 1;
    v_orig_name := NULLIF(trim(coalesce(v_orig->>'allocatedByName','')),'');
    IF v_orig_name IS NULL AND (v_orig->>'allocatedBy') ~ '^[0-9a-fA-F-]{36}$' THEN
      SELECT NULLIF(trim(coalesce(name,'')),'') INTO v_orig_name FROM public.profiles WHERE id = (v_orig->>'allocatedBy')::uuid;
    END IF;
    BEGIN v_orig_at := (v_orig->>'allocatedAt')::timestamptz; EXCEPTION WHEN others THEN v_orig_at := NULL; END;
    UPDATE public.orders SET
      storage_locations = NULLIF((SELECT coalesce(jsonb_agg(l), '[]'::jsonb) FROM jsonb_array_elements(r.storage_locations) l
                            WHERE NOT (upper(l->>'bay') = v_bay AND (l->>'position') ~ '^\d+$' AND (l->>'position')::int = p_pos)), '[]'::jsonb),
      updated_at = now()
     WHERE id = r.id;
    UPDATE public.orders SET misallocated_at = now(), misallocated_from = v_bay || p_pos,
           misallocated_by = v_uid, misallocated_by_name = v_name,
           misallocated_original_by_name = v_orig_name, misallocated_original_at = v_orig_at
     WHERE id = r.id;
    INSERT INTO public.label_scans(order_id, user_id, role, action, detail)
      VALUES (r.id, v_uid, public._label_staff_role(v_uid), 'bay_override', v_bay || '-' || p_pos);
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END $$;
REVOKE EXECUTE ON FUNCTION public.override_bay_slot(uuid, text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.override_bay_slot(uuid, text, int) TO authenticated;

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
    NEW.misallocated_original_by_name := NULL; NEW.misallocated_original_at := NULL;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.orders_stamp_bay_allocator() FROM PUBLIC, anon, authenticated;

-- Best-effort backfill for bikes already in Wrongly allocated: latest bay scan before the override
UPDATE public.orders o SET
  misallocated_original_by_name = (SELECT NULLIF(trim(coalesce(p.name,'')),'') FROM public.label_scans ls
     LEFT JOIN public.profiles p ON p.id = ls.user_id
     WHERE ls.order_id = o.id AND ls.action = 'bay' AND ls.created_at < o.misallocated_at
     ORDER BY ls.created_at DESC LIMIT 1)
WHERE o.misallocated_at IS NOT NULL AND o.misallocated_original_by_name IS NULL;