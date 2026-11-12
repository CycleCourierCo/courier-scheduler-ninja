ALTER TABLE public.bicycle_inspections
  ADD COLUMN IF NOT EXISTS customer_size_response text,
  ADD COLUMN IF NOT EXISTS customer_size_note text,
  ADD COLUMN IF NOT EXISTS customer_size_responded_at timestamptz;

ALTER TABLE public.bicycle_inspections
  DROP CONSTRAINT IF EXISTS bicycle_inspections_customer_size_response_check;
ALTER TABLE public.bicycle_inspections
  ADD CONSTRAINT bicycle_inspections_customer_size_response_check
  CHECK (customer_size_response IS NULL OR customer_size_response IN ('matches','does_not_match'));

CREATE OR REPLACE FUNCTION public._inspection_booked_frame_size(p_insp public.bicycle_inspections)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NULLIF(trim(p_insp.frame_size), '');
$$;
REVOKE EXECUTE ON FUNCTION public._inspection_booked_frame_size(public.bicycle_inspections) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._inspection_booked_frame_size(public.bicycle_inspections) TO service_role;

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
  v_offered_count integer;
  v_booked_size text;
  v_measured text;
BEGIN
  SELECT * INTO v_insp FROM public.bicycle_inspections WHERE id = p_inspection_id;
  IF v_insp.id IS NULL THEN RETURN jsonb_build_object('error','not_found'); END IF;
  IF v_insp.released_to_customer_at IS NULL THEN RETURN jsonb_build_object('error','not_released'); END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',i.id,
    'issue_description',i.issue_description,
    'estimated_cost',i.estimated_cost,
    'status',i.status,
    'customer_response',i.customer_response,
    'offered_to_receiver_at',i.offered_to_receiver_at,
    'receiver_approved_at',i.receiver_approved_at,
    'receiver_declined_at',i.receiver_declined_at
  ) ORDER BY i.created_at),'[]'::jsonb)
  INTO v_issues
  FROM public.inspection_issues i
  WHERE i.inspection_id=v_insp.id;
  SELECT count(*) INTO v_offered_count
  FROM public.inspection_issues i
  WHERE i.inspection_id=v_insp.id
    AND i.offered_to_receiver_at IS NOT NULL
    AND i.receiver_approved_at IS NULL
    AND i.receiver_declined_at IS NULL;
  v_bike := NULLIF(trim(concat_ws(' ',v_insp.bike_brand,v_insp.bike_model)),'');
  v_booked_size := public._inspection_booked_frame_size(v_insp);
  v_measured := CASE WHEN v_booked_size IS NULL THEN NULLIF(trim(v_insp.actual_frame_size),'') END;
  RETURN jsonb_build_object(
    'inspection_id',v_insp.id,
    'order_id',v_insp.order_id,
    'status',v_insp.status,
    'awaiting_receiver_count',v_offered_count,
    'customer_name',v_insp.customer_name,
    'bike',v_bike,
    'frame_size',v_insp.frame_size,
    'measured_frame_size',v_measured,
    'customer_size_response',v_insp.customer_size_response,
    'reference',v_insp.reference,
    'report_url',v_insp.report_url,
    'inspection_type',v_insp.inspection_type,
    'service_decision',v_insp.service_decision,
    'service_price_gbp',v_insp.service_price_gbp,
    'issues',v_issues
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_inspection_size_confirmation(p_inspection_id uuid, p_response text, p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_insp public.bicycle_inspections;
BEGIN
  IF p_response NOT IN ('matches','does_not_match') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_response');
  END IF;
  SELECT * INTO v_insp FROM public.bicycle_inspections WHERE id = p_inspection_id FOR UPDATE;
  IF v_insp.id IS NULL OR v_insp.released_to_customer_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  IF public._inspection_booked_frame_size(v_insp) IS NOT NULL OR NULLIF(trim(v_insp.actual_frame_size),'') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_needed');
  END IF;
  IF v_insp.customer_size_response IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'already', true, 'response', v_insp.customer_size_response);
  END IF;
  UPDATE public.bicycle_inspections
     SET customer_size_response = p_response,
         customer_size_note = NULLIF(left(trim(coalesce(p_note,'')), 500), ''),
         customer_size_responded_at = now()
   WHERE id = p_inspection_id;
  RETURN jsonb_build_object('success', true, 'response', p_response);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.submit_inspection_size_confirmation(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_inspection_size_confirmation(uuid, text, text) TO service_role;