ALTER TABLE public.bicycle_inspections ALTER COLUMN order_id DROP NOT NULL;
ALTER TABLE public.inspection_issues ALTER COLUMN order_id DROP NOT NULL;

ALTER TABLE public.bicycle_inspections
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS customer_email text,
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS customer_company text,
  ADD COLUMN IF NOT EXISTS customer_address jsonb,
  ADD COLUMN IF NOT EXISTS bike_brand text,
  ADD COLUMN IF NOT EXISTS bike_model text,
  ADD COLUMN IF NOT EXISTS frame_size text,
  ADD COLUMN IF NOT EXISTS reference text,
  ADD COLUMN IF NOT EXISTS approval_recipient text,
  ADD COLUMN IF NOT EXISTS approval_sent_to_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by_id uuid,
  ADD COLUMN IF NOT EXISTS created_by_name text;

ALTER TABLE public.bicycle_inspections
  DROP CONSTRAINT IF EXISTS bicycle_inspections_order_or_customer;
ALTER TABLE public.bicycle_inspections
  ADD CONSTRAINT bicycle_inspections_order_or_customer
  CHECK (order_id IS NOT NULL OR customer_email IS NOT NULL);

ALTER TABLE public.bicycle_inspections
  DROP CONSTRAINT IF EXISTS bicycle_inspections_approval_recipient_check;
ALTER TABLE public.bicycle_inspections
  ADD CONSTRAINT bicycle_inspections_approval_recipient_check
  CHECK (approval_recipient IS NULL OR approval_recipient IN ('customer','receiver','walkin'));

CREATE OR REPLACE FUNCTION public.get_public_inspection_approval(p_inspection_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_insp public.bicycle_inspections;
  v_issues jsonb;
  v_bike text;
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
      'customer_response', i.customer_response
    ) ORDER BY i.created_at), '[]'::jsonb)
  INTO v_issues
  FROM public.inspection_issues i
  WHERE i.inspection_id = v_insp.id;

  v_bike := NULLIF(TRIM(CONCAT_WS(' ', v_insp.bike_brand, v_insp.bike_model)), '');

  RETURN jsonb_build_object(
    'inspection_id', v_insp.id,
    'status', v_insp.status,
    'customer_name', v_insp.customer_name,
    'bike', v_bike,
    'frame_size', v_insp.frame_size,
    'reference', v_insp.reference,
    'report_url', v_insp.report_url,
    'issues', v_issues
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_public_inspection_approval(p_inspection_id uuid, p_approved_issue_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_insp public.bicycle_inspections;
  v_approved int := 0;
  v_declined int := 0;
BEGIN
  SELECT * INTO v_insp FROM public.bicycle_inspections WHERE id = p_inspection_id;
  IF v_insp.id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;
  IF v_insp.released_to_customer_at IS NULL THEN
    RETURN jsonb_build_object('error', 'not_released');
  END IF;

  UPDATE public.inspection_issues
  SET status = 'approved',
      customer_response = 'Approved',
      customer_responded_at = now(),
      updated_at = now()
  WHERE inspection_id = v_insp.id
    AND status = 'pending'
    AND id = ANY(COALESCE(p_approved_issue_ids, ARRAY[]::uuid[]));
  GET DIAGNOSTICS v_approved = ROW_COUNT;

  UPDATE public.inspection_issues
  SET status = 'declined',
      customer_response = 'Declined',
      customer_responded_at = now(),
      updated_at = now()
  WHERE inspection_id = v_insp.id
    AND status = 'pending'
    AND NOT (id = ANY(COALESCE(p_approved_issue_ids, ARRAY[]::uuid[])));
  GET DIAGNOSTICS v_declined = ROW_COUNT;

  UPDATE public.bicycle_inspections
  SET status = CASE
        WHEN v_approved > 0 THEN 'awaiting_repair'
        WHEN v_declined > 0 THEN 'repairs_declined'
        ELSE status
      END,
      updated_at = now()
  WHERE id = v_insp.id;

  RETURN jsonb_build_object('success', true, 'approved', v_approved, 'declined', v_declined);
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_inspection_approval(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_public_inspection_approval(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_inspection_approval(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_public_inspection_approval(uuid, uuid[]) TO anon, authenticated;