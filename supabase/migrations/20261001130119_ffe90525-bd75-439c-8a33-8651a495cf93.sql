CREATE OR REPLACE FUNCTION public.recompute_inspection_stage(p_inspection_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text; v_pending int; v_declined_open int; v_approved int; v_missing int; v_next text;
BEGIN
  SELECT status INTO v_status FROM bicycle_inspections WHERE id = p_inspection_id;
  IF v_status IS NULL OR v_status NOT IN ('issues_found','awaiting_parts','awaiting_repair') THEN RETURN; END IF;
  SELECT count(*) FILTER (WHERE status='pending'),
         count(*) FILTER (WHERE status='approved'),
         count(*) FILTER (WHERE status='approved' AND NOT (coalesce(parts_in_stock,false) OR coalesce(parts_arrived,false)))
    INTO v_pending, v_approved, v_missing
    FROM inspection_issues WHERE inspection_id = p_inspection_id;
  IF v_pending > 0 OR v_approved = 0 THEN RETURN; END IF;
  -- issues_found with declined work is handled by the buyer-wait flow
  IF v_status = 'issues_found' AND EXISTS (SELECT 1 FROM inspection_issues WHERE inspection_id=p_inspection_id AND status='declined') THEN RETURN; END IF;
  v_next := CASE WHEN v_missing > 0 THEN 'awaiting_parts' ELSE 'awaiting_repair' END;
  IF v_next <> v_status THEN
    UPDATE bicycle_inspections SET status = v_next, updated_at = now() WHERE id = p_inspection_id;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.recompute_inspection_stage(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.inspection_issues_recompute_stage()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recompute_inspection_stage(COALESCE(NEW.inspection_id, OLD.inspection_id));
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.inspection_issues_recompute_stage() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_inspection_issues_recompute_stage ON public.inspection_issues;
CREATE TRIGGER trg_inspection_issues_recompute_stage
AFTER INSERT OR DELETE OR UPDATE OF status, parts_ordered, parts_arrived, parts_in_stock ON public.inspection_issues
FOR EACH ROW EXECUTE FUNCTION public.inspection_issues_recompute_stage();

DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT id FROM bicycle_inspections WHERE status IN ('issues_found','awaiting_parts','awaiting_repair') LOOP
    PERFORM public.recompute_inspection_stage(r.id);
  END LOOP;
END $$;