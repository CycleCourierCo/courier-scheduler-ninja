-- H1: pin pay/commercial fields on self-updates
CREATE OR REPLACE FUNCTION public.profiles_guard_pay_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin_or_sales() THEN RETURN NEW; END IF;
  IF NEW.hourly_rate IS DISTINCT FROM OLD.hourly_rate
     OR NEW.pay_type IS DISTINCT FROM OLD.pay_type
     OR NEW.per_mile_rate IS DISTINCT FROM OLD.per_mile_rate
     OR NEW.uses_own_van IS DISTINCT FROM OLD.uses_own_van
     OR NEW.van_allowance IS DISTINCT FROM OLD.van_allowance
     OR NEW.workshop_hourly_rate IS DISTINCT FROM OLD.workshop_hourly_rate
     OR NEW.special_rate_code IS DISTINCT FROM OLD.special_rate_code
     OR NEW.special_rate_price IS DISTINCT FROM OLD.special_rate_price
     OR NEW.large_bike_rate_code IS DISTINCT FROM OLD.large_bike_rate_code
     OR NEW.large_bike_rate_price IS DISTINCT FROM OLD.large_bike_rate_price
     OR NEW.large_bike_rate_from IS DISTINCT FROM OLD.large_bike_rate_from
     OR NEW.annual_leave_days IS DISTINCT FROM OLD.annual_leave_days
     OR NEW.is_test_account IS DISTINCT FROM OLD.is_test_account
     OR NEW.quickbooks_customer_id IS DISTINCT FROM OLD.quickbooks_customer_id THEN
    RAISE EXCEPTION 'Only admin can change pay or pricing fields' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS profiles_guard_pay_fields ON public.profiles;
CREATE TRIGGER profiles_guard_pay_fields BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_guard_pay_fields();

-- H6: only admins create appraisals
DROP POLICY IF EXISTS review_cycles_insert ON public.review_cycles;
CREATE POLICY review_cycles_insert ON public.review_cycles FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- H5: employees cannot change who reviews them or who is reviewed
CREATE OR REPLACE FUNCTION public.review_cycles_guard_parties()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN RETURN NEW; END IF;
  IF NEW.reviewer_id IS DISTINCT FROM OLD.reviewer_id OR NEW.employee_id IS DISTINCT FROM OLD.employee_id THEN
    RAISE EXCEPTION 'Only admin can change reviewer or employee' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS review_cycles_guard_parties ON public.review_cycles;
CREATE TRIGGER review_cycles_guard_parties BEFORE UPDATE ON public.review_cycles
  FOR EACH ROW EXECUTE FUNCTION public.review_cycles_guard_parties();

-- H7/H8: customers may only answer; mechanics may not record customer approval
CREATE OR REPLACE FUNCTION public.inspection_issues_guard_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_diff text[];
BEGIN
  IF v_uid IS NULL OR public.has_role(v_uid, 'admin'::user_role) THEN RETURN NEW; END IF;
  IF public.has_role(v_uid, 'mechanic'::user_role) THEN
    IF (NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved')
       OR NEW.receiver_approved_at IS DISTINCT FROM OLD.receiver_approved_at
       OR NEW.receiver_approved_source IS DISTINCT FROM OLD.receiver_approved_source THEN
      RAISE EXCEPTION 'Mechanics cannot approve repairs on behalf of the customer' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  -- customer (order owner): only status approve/decline + response fields
  SELECT array_agg(n.key) INTO v_diff
    FROM jsonb_each(to_jsonb(NEW)) n JOIN jsonb_each(to_jsonb(OLD)) o USING (key)
   WHERE n.value IS DISTINCT FROM o.value
     AND n.key NOT IN ('status','customer_response','customer_responded_at','updated_at');
  IF v_diff IS NOT NULL THEN
    RAISE EXCEPTION 'Customers can only approve or decline repairs' USING ERRCODE = '42501';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status NOT IN ('approved','declined') THEN
    RAISE EXCEPTION 'Customers can only approve or decline repairs' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS inspection_issues_guard_update ON public.inspection_issues;
CREATE TRIGGER inspection_issues_guard_update BEFORE UPDATE ON public.inspection_issues
  FOR EACH ROW EXECUTE FUNCTION public.inspection_issues_guard_update();

-- M11: staff edit only their own recurring templates; admins edit all
DROP POLICY IF EXISTS "Internal staff can create recurrences" ON public.task_recurrences;
CREATE POLICY "Internal staff can create recurrences" ON public.task_recurrences FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR (public.is_internal_staff(auth.uid()) AND created_by = (SELECT auth.uid())));
DROP POLICY IF EXISTS "Internal staff can update recurrences" ON public.task_recurrences;
CREATE POLICY "Internal staff can update recurrences" ON public.task_recurrences FOR UPDATE TO authenticated
  USING (public.is_admin() OR (public.is_internal_staff(auth.uid()) AND created_by = (SELECT auth.uid())))
  WITH CHECK (public.is_admin() OR (public.is_internal_staff(auth.uid()) AND created_by = (SELECT auth.uid())));

-- M12: serialise bay slot allocation
CREATE OR REPLACE FUNCTION public.label_scan_action(p_order_id uuid, p_action text, p_detail text DEFAULT NULL::text, p_lat double precision DEFAULT NULL::double precision, p_lon double precision DEFAULT NULL::double precision)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
END $function$;