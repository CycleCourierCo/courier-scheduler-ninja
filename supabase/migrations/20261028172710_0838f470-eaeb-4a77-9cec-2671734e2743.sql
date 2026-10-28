-- 1. Finalised fleet inspection results can never be moved or edited
CREATE OR REPLACE FUNCTION public.fleet_inspection_results_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE st text; old_st text; iid uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.inspection_id IS DISTINCT FROM OLD.inspection_id THEN
    RAISE EXCEPTION 'Inspection results cannot be moved to another inspection';
  END IF;
  iid := CASE WHEN TG_OP = 'DELETE' THEN OLD.inspection_id ELSE NEW.inspection_id END;
  SELECT status INTO st FROM public.fleet_inspections WHERE id = iid;
  IF TG_OP = 'DELETE' AND st IS NULL THEN RETURN OLD; END IF; -- parent already removed (cascade)
  IF st = 'final' THEN
    IF TG_OP = 'UPDATE'
       AND NEW.result IS NOT DISTINCT FROM OLD.result AND NEW.reason IS NOT DISTINCT FROM OLD.reason
       AND NEW.tread_fl IS NOT DISTINCT FROM OLD.tread_fl AND NEW.tread_fr IS NOT DISTINCT FROM OLD.tread_fr
       AND NEW.tread_rl IS NOT DISTINCT FROM OLD.tread_rl AND NEW.tread_rr IS NOT DISTINCT FROM OLD.tread_rr
       AND to_jsonb(NEW) - ARRAY['defect_id','vehicle_issue_id','updated_at']
           = to_jsonb(OLD) - ARRAY['defect_id','vehicle_issue_id','updated_at'] THEN
      RETURN NEW; -- only linking a defect is allowed after finalising
    END IF;
    RAISE EXCEPTION 'This inspection is finalised and locked';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF NEW.result NOT IN ('pass','fail','na','not_checked') THEN RAISE EXCEPTION 'Invalid result'; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- 2. Drivers may only submit proof for orders on a route assigned to them (day before .. day after capture)
CREATE OR REPLACE FUNCTION public.driver_can_prove_order(_uid uuid, _order_id uuid, _captured timestamptz)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM saved_route_assignments sa JOIN saved_routes r ON r.id = sa.saved_route_id
    WHERE sa.driver_id = _uid
      AND sa.route_date BETWEEN ((_captured AT TIME ZONE 'Europe/London')::date - 1)
                            AND ((_captured AT TIME ZONE 'Europe/London')::date + 1)
      AND EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(r.job_data,'[]'::jsonb)) s
                  WHERE s->>'orderId' = _order_id::text)
  );
$$;
REVOKE ALL ON FUNCTION public.driver_can_prove_order(uuid, uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.driver_can_prove_order(uuid, uuid, timestamptz) TO authenticated, service_role;

DROP POLICY IF EXISTS delivery_proofs_insert ON public.delivery_proofs;
CREATE POLICY delivery_proofs_insert ON public.delivery_proofs FOR INSERT TO authenticated
  WITH CHECK (
    driver_id = (SELECT auth.uid())
    AND has_role((SELECT auth.uid()), 'driver'::user_role)
    AND captured_at <= now() + interval '10 minutes'
    AND public.driver_can_prove_order((SELECT auth.uid()), order_id, captured_at)
  );