ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS loaded_onto_van_by uuid,
  ADD COLUMN IF NOT EXISTS loaded_onto_van_by_name text,
  ADD COLUMN IF NOT EXISTS loaded_from_locations jsonb;

CREATE OR REPLACE FUNCTION public.orders_stamp_taken_out()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF COALESCE(NEW.loaded_onto_van,false) AND NOT COALESCE(OLD.loaded_onto_van,false) THEN
    NEW.loaded_onto_van_by := v_uid;
    NEW.loaded_onto_van_by_name := (SELECT NULLIF(trim(coalesce(name,'')),'') FROM public.profiles WHERE id = v_uid);
    IF jsonb_typeof(OLD.storage_locations) = 'array' AND jsonb_array_length(OLD.storage_locations) > 0 THEN
      NEW.loaded_from_locations := OLD.storage_locations;
    END IF;
  ELSIF NOT COALESCE(NEW.loaded_onto_van,false) AND COALESCE(OLD.loaded_onto_van,false) THEN
    NEW.loaded_onto_van_by := NULL;
    NEW.loaded_onto_van_by_name := NULL;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.orders_stamp_taken_out() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS orders_stamp_taken_out ON public.orders;
CREATE TRIGGER orders_stamp_taken_out BEFORE UPDATE OF loaded_onto_van ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_stamp_taken_out();

CREATE OR REPLACE FUNCTION public.undo_taken_out(p_order_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_n int;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501';
  END IF;
  UPDATE public.orders SET loaded_onto_van = false, loaded_onto_van_at = NULL,
         storage_locations = loaded_from_locations, loaded_from_locations = NULL, updated_at = now()
   WHERE id = p_order_id AND loaded_onto_van = true;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN RETURN false; END IF;
  INSERT INTO public.label_scans(order_id, user_id, role, action, detail)
    VALUES (p_order_id, v_uid, public._label_staff_role(v_uid), 'undo_taken_out', NULL);
  RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.undo_taken_out(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.undo_taken_out(uuid) TO authenticated, service_role;