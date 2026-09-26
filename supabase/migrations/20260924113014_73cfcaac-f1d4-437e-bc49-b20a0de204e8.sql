CREATE OR REPLACE FUNCTION public.submit_public_inspection_approval(p_inspection_id uuid, p_approved_issue_ids uuid[])
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_insp public.bicycle_inspections;
  v_approved int := 0;
  v_declined int := 0;
  v_onward boolean;
BEGIN
  SELECT * INTO v_insp FROM public.bicycle_inspections WHERE id = p_inspection_id;
  IF v_insp.id IS NULL THEN RETURN jsonb_build_object('error', 'not_found'); END IF;
  IF v_insp.released_to_customer_at IS NULL THEN RETURN jsonb_build_object('error', 'not_released'); END IF;

  UPDATE public.inspection_issues
  SET status = 'approved', customer_response = 'Approved', customer_responded_at = now(), updated_at = now()
  WHERE inspection_id = v_insp.id AND status = 'pending'
    AND id = ANY(COALESCE(p_approved_issue_ids, ARRAY[]::uuid[]));
  GET DIAGNOSTICS v_approved = ROW_COUNT;

  UPDATE public.inspection_issues
  SET status = 'declined', customer_response = 'Declined', customer_responded_at = now(), updated_at = now()
  WHERE inspection_id = v_insp.id AND status = 'pending'
    AND NOT (id = ANY(COALESCE(p_approved_issue_ids, ARRAY[]::uuid[])));
  GET DIAGNOSTICS v_declined = ROW_COUNT;

  v_onward := v_insp.order_id IS NOT NULL
    AND COALESCE(v_insp.approval_recipient, 'customer') NOT IN ('receiver', 'walkin');

  UPDATE public.bicycle_inspections
  SET status = CASE
        WHEN v_declined > 0 AND v_onward THEN 'repairs_declined'
        WHEN v_approved > 0 THEN 'awaiting_repair'
        WHEN v_declined > 0 THEN 'repairs_declined'
        ELSE status
      END,
      updated_at = now()
  WHERE id = v_insp.id;

  RETURN jsonb_build_object('success', true, 'approved', v_approved, 'declined', v_declined);
END;
$function$;