CREATE OR REPLACE FUNCTION public.orders_guard_bay_occupancy()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e jsonb; v_bay text; v_pos int; v_occ text;
BEGIN
  IF jsonb_typeof(NEW.storage_locations) <> 'array' OR jsonb_array_length(NEW.storage_locations) = 0 THEN RETURN NEW; END IF;
  IF NEW.status::text IN ('cancelled','delivered') OR NEW.loaded_onto_van IS TRUE THEN RETURN NEW; END IF;
  FOR e IN SELECT * FROM jsonb_array_elements(NEW.storage_locations) LOOP
    CONTINUE WHEN jsonb_typeof(e) <> 'object' OR e->>'bay' IS NULL OR NOT ((e->>'position') ~ '^\d+$');
    v_bay := upper(trim(e->>'bay')); v_pos := (e->>'position')::int;
    -- only check slots newly added by this change, so old data never blocks unrelated saves
    IF TG_OP = 'UPDATE' AND jsonb_typeof(OLD.storage_locations) = 'array' AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(OLD.storage_locations) o
       WHERE upper(trim(o->>'bay')) = v_bay AND (o->>'position') ~ '^\d+$' AND (o->>'position')::int = v_pos) THEN
      CONTINUE;
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('bay:' || v_bay || ':' || v_pos, 0));
    SELECT coalesce(o.tracking_number, o.id::text) INTO v_occ FROM public.orders o
     WHERE o.id <> NEW.id AND jsonb_typeof(o.storage_locations) = 'array'
       AND o.status::text NOT IN ('cancelled','delivered') AND o.loaded_onto_van IS NOT TRUE
       AND EXISTS (SELECT 1 FROM jsonb_array_elements(o.storage_locations) l
                    WHERE upper(trim(l->>'bay')) = v_bay AND (l->>'position') ~ '^\d+$' AND (l->>'position')::int = v_pos)
     LIMIT 1;
    IF v_occ IS NOT NULL THEN
      RAISE EXCEPTION 'Bay %-% is already occupied by %', v_bay, v_pos, v_occ USING ERRCODE = 'P0001';
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.orders_guard_bay_occupancy() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_orders_guard_bay_occupancy ON public.orders;
CREATE TRIGGER trg_orders_guard_bay_occupancy BEFORE INSERT OR UPDATE OF storage_locations ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_guard_bay_occupancy();