CREATE OR REPLACE FUNCTION public.submit_inspection_approval_internal(p_inspection_id uuid, p_approved_issue_ids uuid[], p_service_decision text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_insp public.bicycle_inspections; v_result jsonb; v_open integer;
BEGIN
 SELECT * INTO v_insp FROM public.bicycle_inspections WHERE id=p_inspection_id FOR UPDATE;
 IF v_insp.id IS NULL THEN RETURN jsonb_build_object('error','not_found'); END IF;
 IF v_insp.released_to_customer_at IS NULL THEN RETURN jsonb_build_object('error','not_released'); END IF;
 IF v_insp.inspection_type='inspection_only' AND v_insp.service_decision='pending' AND p_service_decision IS DISTINCT FROM 'accepted' AND p_service_decision IS DISTINCT FROM 'declined' THEN RETURN jsonb_build_object('error','service_choice_required'); END IF;
 IF v_insp.inspection_type='inspection_only' AND p_service_decision='accepted' AND v_insp.service_price_gbp IS NULL THEN RETURN jsonb_build_object('error','service_price_unavailable'); END IF;
 IF v_insp.service_decision <> 'pending' AND p_service_decision IS NOT NULL AND p_service_decision IS DISTINCT FROM v_insp.service_decision THEN RETURN jsonb_build_object('error','service_choice_already_recorded'); END IF;
 IF EXISTS (SELECT 1 FROM unnest(COALESCE(p_approved_issue_ids,ARRAY[]::uuid[])) AS chosen(id) WHERE NOT EXISTS (SELECT 1 FROM public.inspection_issues i WHERE i.id=chosen.id AND i.inspection_id=p_inspection_id AND i.status='pending')) THEN RETURN jsonb_build_object('error','invalid_repair_choice'); END IF;
 SELECT count(*) INTO v_open FROM public.inspection_issues WHERE inspection_id=p_inspection_id AND status='pending';
 IF v_open=0 AND v_insp.service_decision <> 'pending' THEN RETURN jsonb_build_object('error','already_submitted'); END IF;
 IF v_insp.inspection_type='inspection_only' AND v_insp.service_decision='pending' THEN UPDATE public.bicycle_inspections SET service_decision=p_service_decision WHERE id=p_inspection_id; END IF;
 v_result := public.submit_public_inspection_approval(p_inspection_id,p_approved_issue_ids);
 IF v_result->>'success' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'approval_failed'; END IF;
 IF v_insp.inspection_type='inspection_only' AND COALESCE((v_result->>'approved')::integer,0)=0 THEN
   IF p_service_decision='accepted' AND (COALESCE((v_result->>'declined')::integer,0)=0 OR v_insp.order_id IS NULL OR v_insp.approval_recipient IN ('walkin','receiver')) THEN
     UPDATE public.bicycle_inspections SET status=CASE WHEN frame_cleaned_at IS NOT NULL AND drivetrain_degreased_at IS NOT NULL THEN 'inspected' ELSE 'cleaning' END WHERE id=p_inspection_id;
   ELSIF p_service_decision='declined' AND COALESCE((v_result->>'declined')::integer,0)=0 THEN
     UPDATE public.bicycle_inspections SET status='ship_as_is' WHERE id=p_inspection_id;
   END IF;
 END IF;
 RETURN v_result || jsonb_build_object('service_decision',COALESCE(p_service_decision,v_insp.service_decision));
END; $$;
REVOKE ALL ON FUNCTION public.submit_inspection_approval_internal(uuid,uuid[],text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_inspection_approval_internal(uuid,uuid[],text) TO service_role;