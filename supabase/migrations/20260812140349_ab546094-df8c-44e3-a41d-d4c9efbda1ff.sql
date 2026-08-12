ALTER TABLE public.inspection_issues
  ADD COLUMN IF NOT EXISTS offered_to_receiver_at timestamptz,
  ADD COLUMN IF NOT EXISTS offered_to_receiver_by_id uuid,
  ADD COLUMN IF NOT EXISTS offered_to_receiver_by_name text,
  ADD COLUMN IF NOT EXISTS receiver_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS receiver_approved_source text,
  ADD COLUMN IF NOT EXISTS receiver_declined_at timestamptz,
  ADD COLUMN IF NOT EXISTS billing_party text NOT NULL DEFAULT 'customer';

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

CREATE OR REPLACE FUNCTION public.submit_public_repair_offer(
  p_order_id uuid,
  p_approved_issue_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_approved int := 0;
  v_declined int := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = p_order_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  UPDATE public.inspection_issues i
  SET status = 'approved',
      billing_party = 'receiver',
      receiver_approved_at = now(),
      receiver_approved_source = 'receiver',
      receiver_declined_at = NULL,
      customer_response = 'Approved by receiver',
      customer_responded_at = now(),
      updated_at = now()
  WHERE i.order_id = p_order_id
    AND i.status = 'declined'
    AND i.offered_to_receiver_at IS NOT NULL
    AND i.receiver_declined_at IS NULL
    AND i.id = ANY(COALESCE(p_approved_issue_ids, ARRAY[]::uuid[]));
  GET DIAGNOSTICS v_approved = ROW_COUNT;

  UPDATE public.inspection_issues i
  SET receiver_declined_at = now(),
      updated_at = now()
  WHERE i.order_id = p_order_id
    AND i.status = 'declined'
    AND i.offered_to_receiver_at IS NOT NULL
    AND i.receiver_declined_at IS NULL
    AND NOT (i.id = ANY(COALESCE(p_approved_issue_ids, ARRAY[]::uuid[])));
  GET DIAGNOSTICS v_declined = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'approved', v_approved, 'declined', v_declined);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_repair_offer(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_public_repair_offer(uuid, uuid[]) TO anon, authenticated;