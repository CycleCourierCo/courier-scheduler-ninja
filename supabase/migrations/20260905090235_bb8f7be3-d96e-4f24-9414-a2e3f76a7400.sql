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

  SELECT id, status, inspected_at, released_to_customer_at, report_url, created_at, updated_at
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

  -- A finished workshop record (inspected / repaired) is customer-visible even when
  -- the explicit "released to customer" stamp was never set — that stamp only gets
  -- written on the approval-email route, so in-house approvals used to leave the
  -- customer stuck on "still in the workshop".
  v_public_inspected_at := CASE
    WHEN v_inspection.status IN ('inspected', 'repaired')
      THEN coalesce(v_inspection.released_to_customer_at, v_inspection.inspected_at, v_inspection.updated_at)
    ELSE v_inspection.released_to_customer_at
  END;

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

  -- A repaired record is complete even if individual issue rows never got a resolved_at.
  IF v_inspection.status = 'repaired' AND v_approved > 0 THEN
    v_repairs_completed_at := coalesce(v_repairs_completed_at, v_inspection.updated_at);
    v_resolved := greatest(v_resolved, v_approved);
  END IF;

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