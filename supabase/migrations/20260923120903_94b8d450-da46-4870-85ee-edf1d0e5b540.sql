CREATE OR REPLACE FUNCTION public.get_public_inspection_approval(p_inspection_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_insp public.bicycle_inspections;
  v_issues jsonb;
  v_bike text;
  v_offered_count int := 0;
BEGIN
  SELECT * INTO v_insp FROM public.bicycle_inspections WHERE id = p_inspection_id;
  IF v_insp.id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;
  IF v_insp.released_to_customer_at IS NULL THEN
    RETURN jsonb_build_object('error', 'not_released');
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', i.id,
      'issue_description', i.issue_description,
      'estimated_cost', i.estimated_cost,
      'status', i.status,
      'customer_response', i.customer_response,
      'offered_to_receiver_at', i.offered_to_receiver_at,
      'receiver_approved_at', i.receiver_approved_at,
      'receiver_declined_at', i.receiver_declined_at
    ) ORDER BY i.created_at), '[]'::jsonb)
  INTO v_issues
  FROM public.inspection_issues i
  WHERE i.inspection_id = v_insp.id;

  SELECT COUNT(*) INTO v_offered_count
  FROM public.inspection_issues i
  WHERE i.inspection_id = v_insp.id
    AND i.offered_to_receiver_at IS NOT NULL
    AND i.receiver_approved_at IS NULL
    AND i.receiver_declined_at IS NULL;

  v_bike := NULLIF(TRIM(CONCAT_WS(' ', v_insp.bike_brand, v_insp.bike_model)), '');

  RETURN jsonb_build_object(
    'inspection_id', v_insp.id,
    'order_id', v_insp.order_id,
    'status', v_insp.status,
    'awaiting_receiver_count', v_offered_count,
    'customer_name', v_insp.customer_name,
    'bike', v_bike,
    'frame_size', v_insp.frame_size,
    'reference', v_insp.reference,
    'report_url', v_insp.report_url,
    'issues', v_issues
  );
END;
$function$;