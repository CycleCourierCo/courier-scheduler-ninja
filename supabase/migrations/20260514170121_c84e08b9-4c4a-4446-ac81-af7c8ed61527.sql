CREATE OR REPLACE FUNCTION public.get_public_inspection_summary(order_identifier text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_id uuid;
  v_inspection record;
  v_total int := 0;
  v_pending int := 0;
  v_approved int := 0;
  v_declined int := 0;
  v_resolved int := 0;
  v_repairs_approved_at timestamptz;
  v_repairs_declined_at timestamptz;
  v_repairs_completed_at timestamptz;
BEGIN
  IF order_identifier IS NULL OR length(order_identifier) = 0 THEN
    RETURN NULL;
  END IF;

  -- Resolve order by id, tracking_number, or customer_order_number
  SELECT id INTO v_order_id
  FROM public.orders
  WHERE (
      (order_identifier ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND id::text = order_identifier)
      OR tracking_number = order_identifier
      OR customer_order_number = order_identifier
    )
    AND tracking_number IS NOT NULL
  LIMIT 1;

  IF v_order_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id, status, inspected_at
  INTO v_inspection
  FROM public.bicycle_inspections
  WHERE order_id = v_order_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_inspection.id IS NULL THEN
    RETURN jsonb_build_object(
      'inspection_exists', false,
      'inspected_at', null,
      'has_issues', false,
      'total_issues', 0,
      'pending_count', 0,
      'approved_count', 0,
      'declined_count', 0,
      'resolved_count', 0,
      'repairs_approved_at', null,
      'repairs_declined_at', null,
      'repairs_completed_at', null
    );
  END IF;

  SELECT
    count(*),
    count(*) FILTER (WHERE status = 'pending'),
    count(*) FILTER (WHERE status = 'approved'),
    count(*) FILTER (WHERE status = 'declined'),
    count(*) FILTER (WHERE status IN ('resolved', 'repaired')),
    min(customer_responded_at) FILTER (WHERE status = 'approved'),
    max(customer_responded_at) FILTER (WHERE status = 'declined'),
    max(resolved_at) FILTER (WHERE status IN ('resolved', 'repaired'))
  INTO
    v_total, v_pending, v_approved, v_declined, v_resolved,
    v_repairs_approved_at, v_repairs_declined_at, v_repairs_completed_at
  FROM public.inspection_issues
  WHERE inspection_id = v_inspection.id;

  RETURN jsonb_build_object(
    'inspection_exists', true,
    'inspected_at', v_inspection.inspected_at,
    'has_issues', v_total > 0,
    'total_issues', v_total,
    'pending_count', v_pending,
    'approved_count', v_approved,
    'declined_count', v_declined,
    'resolved_count', v_resolved,
    'repairs_approved_at', v_repairs_approved_at,
    'repairs_declined_at', CASE WHEN v_approved = 0 AND v_declined > 0 AND v_declined = v_total THEN v_repairs_declined_at ELSE null END,
    'repairs_completed_at', CASE WHEN v_approved > 0 AND v_resolved >= v_approved THEN v_repairs_completed_at ELSE null END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_inspection_summary(text) TO anon, authenticated;