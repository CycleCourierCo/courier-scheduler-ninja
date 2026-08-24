CREATE OR REPLACE FUNCTION public.get_public_inspection_summary(order_identifier text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id uuid;
  v_inspection record;
  v_total int := 0;
  v_pending int := 0;
  v_approved int := 0;
  v_declined int := 0;
  v_resolved int := 0;
  v_parts_arrived_count int := 0;
  v_repairs_approved_at timestamptz;
  v_repairs_declined_at timestamptz;
  v_repairs_completed_at timestamptz;
  v_awaiting_parts_at timestamptz;
  v_awaiting_repair_at timestamptz;
  v_public_inspected_at timestamptz;
  -- Legacy inspections (before this cutoff) must not expose a report PDF to customers.
  v_report_cutoff constant timestamptz := '2026-08-25 00:00:00+01'::timestamptz;
  v_report_url text;
BEGIN
  IF order_identifier IS NULL OR length(order_identifier) = 0 THEN
    RETURN NULL;
  END IF;

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

  SELECT id, status, inspected_at, released_to_customer_at, report_url, created_at
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
      'repairs_completed_at', null,
      'awaiting_parts_at', null,
      'awaiting_repair_at', null,
      'report_url', null
    );
  END IF;

  v_public_inspected_at := v_inspection.released_to_customer_at;
  v_report_url := CASE
    WHEN v_inspection.created_at >= v_report_cutoff THEN v_inspection.report_url
    ELSE NULL
  END;

  SELECT
    count(*),
    count(*) FILTER (WHERE status = 'pending'),
    count(*) FILTER (WHERE status IN ('approved', 'resolved', 'repaired')),
    count(*) FILTER (WHERE status = 'declined'),
    count(*) FILTER (WHERE status IN ('resolved', 'repaired')),
    count(*) FILTER (WHERE parts_arrived = true AND status IN ('approved','resolved','repaired')),
    min(customer_responded_at) FILTER (
      WHERE status IN ('approved', 'resolved', 'repaired')
         OR customer_response = 'Approved'
    ),
    max(customer_responded_at) FILTER (WHERE status = 'declined'),
    max(resolved_at) FILTER (WHERE status IN ('resolved', 'repaired')),
    max(parts_arrived_at) FILTER (WHERE parts_arrived = true AND status IN ('approved','resolved','repaired'))
  INTO
    v_total, v_pending, v_approved, v_declined, v_resolved, v_parts_arrived_count,
    v_repairs_approved_at, v_repairs_declined_at, v_repairs_completed_at,
    v_awaiting_repair_at
  FROM public.inspection_issues
  WHERE inspection_id = v_inspection.id;

  v_awaiting_parts_at := CASE WHEN v_approved > 0 THEN v_repairs_approved_at ELSE NULL END;
  v_awaiting_repair_at := CASE WHEN v_approved > 0 AND v_parts_arrived_count >= v_approved THEN v_awaiting_repair_at ELSE NULL END;

  RETURN jsonb_build_object(
    'inspection_exists', v_public_inspected_at IS NOT NULL,
    'inspected_at', v_public_inspected_at,
    'has_issues', v_total > 0 AND v_public_inspected_at IS NOT NULL,
    'total_issues', CASE WHEN v_public_inspected_at IS NOT NULL THEN v_total ELSE 0 END,
    'pending_count', CASE WHEN v_public_inspected_at IS NOT NULL THEN v_pending ELSE 0 END,
    'approved_count', CASE WHEN v_public_inspected_at IS NOT NULL THEN v_approved ELSE 0 END,
    'declined_count', CASE WHEN v_public_inspected_at IS NOT NULL THEN v_declined ELSE 0 END,
    'resolved_count', CASE WHEN v_public_inspected_at IS NOT NULL THEN v_resolved ELSE 0 END,
    'repairs_approved_at', CASE WHEN v_public_inspected_at IS NOT NULL THEN v_repairs_approved_at ELSE NULL END,
    'repairs_declined_at', CASE WHEN v_public_inspected_at IS NOT NULL AND v_approved = 0 AND v_declined > 0 AND v_declined = v_total THEN v_repairs_declined_at ELSE NULL END,
    'repairs_completed_at', CASE WHEN v_public_inspected_at IS NOT NULL AND v_approved > 0 AND v_resolved >= v_approved THEN v_repairs_completed_at ELSE NULL END,
    'awaiting_parts_at', CASE WHEN v_public_inspected_at IS NOT NULL THEN v_awaiting_parts_at ELSE NULL END,
    'awaiting_repair_at', CASE WHEN v_public_inspected_at IS NOT NULL THEN v_awaiting_repair_at ELSE NULL END,
    'report_url', CASE WHEN v_public_inspected_at IS NOT NULL THEN v_report_url ELSE NULL END
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_public_repair_offer(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders;
  v_result jsonb;
  -- Legacy inspections (before this cutoff) must not expose a report PDF to customers.
  v_report_cutoff constant timestamptz := '2026-08-25 00:00:00+01'::timestamptz;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT jsonb_build_object(
    'found', true,
    'order_id', v_order.id,
    'tracking_number', v_order.tracking_number,
    'bike_brand', v_order.bike_brand,
    'bike_model', v_order.bike_model,
    'receiver_name', NULLIF(v_order.receiver->>'name', ''),
    'report_url', (
      SELECT bi.report_url
      FROM public.bicycle_inspections bi
      WHERE bi.order_id = v_order.id
        AND bi.report_url IS NOT NULL
        AND bi.created_at >= v_report_cutoff
      ORDER BY bi.created_at DESC
      LIMIT 1
    ),
    'approved', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id,
        'description', i.issue_description
      ) ORDER BY i.created_at)
      FROM public.inspection_issues i
      WHERE i.order_id = v_order.id
        AND i.status IN ('approved', 'resolved', 'repaired')
        AND i.billing_party = 'customer'
    ), '[]'::jsonb),
    'offered', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id,
        'description', i.issue_description,
        'cost', COALESCE(i.estimated_cost, 0)
      ) ORDER BY i.created_at)
      FROM public.inspection_issues i
      WHERE i.order_id = v_order.id
        AND i.status = 'declined'
        AND i.offered_to_receiver_at IS NOT NULL
        AND i.receiver_declined_at IS NULL
    ), '[]'::jsonb),
    'receiver_approved', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id,
        'description', i.issue_description,
        'cost', COALESCE(i.estimated_cost, 0)
      ) ORDER BY i.created_at)
      FROM public.inspection_issues i
      WHERE i.order_id = v_order.id
        AND i.billing_party = 'receiver'
    ), '[]'::jsonb),
    'responded_at', (
      SELECT MAX(GREATEST(COALESCE(i.receiver_approved_at, '-infinity'::timestamptz),
                          COALESCE(i.receiver_declined_at, '-infinity'::timestamptz)))
      FROM public.inspection_issues i
      WHERE i.order_id = v_order.id
        AND (i.receiver_approved_at IS NOT NULL OR i.receiver_declined_at IS NOT NULL)
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_repair_offer(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_inspection_summary(text) TO anon, authenticated;