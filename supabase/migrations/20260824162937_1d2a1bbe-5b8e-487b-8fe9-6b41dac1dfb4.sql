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