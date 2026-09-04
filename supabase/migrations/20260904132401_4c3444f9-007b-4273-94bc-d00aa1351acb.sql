CREATE OR REPLACE FUNCTION public.submit_public_repair_offer(p_order_id uuid, p_approved_issue_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_approved int := 0;
  v_declined int := 0;
  r record;
  v_next text;
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

  -- Advance the workshop stage for each affected inspection.
  FOR r IN
    SELECT ins.id,
           ins.status,
           COUNT(*) FILTER (
             WHERE i.status = 'approved'
           ) AS outstanding_approved,
           COUNT(*) FILTER (
             WHERE i.status = 'approved'
               AND NOT (i.parts_in_stock IS TRUE OR (i.parts_arrived IS TRUE AND i.parts_ordered IS TRUE))
           ) AS approved_awaiting_parts,
           COUNT(*) FILTER (
             WHERE i.status = 'declined' AND i.receiver_declined_at IS NULL AND i.offered_to_receiver_at IS NULL
           ) AS declined_not_offered,
           COUNT(*) FILTER (
             WHERE i.status = 'declined' AND i.receiver_declined_at IS NULL AND i.offered_to_receiver_at IS NOT NULL
           ) AS declined_offered
    FROM public.bicycle_inspections ins
    JOIN public.inspection_issues i ON i.inspection_id = ins.id
    WHERE ins.order_id = p_order_id
      AND ins.status IN ('issues_found', 'repairs_declined', 'pending_receiver_approval', 'awaiting_parts', 'awaiting_repair', 'in_repair')
    GROUP BY ins.id, ins.status
  LOOP
    IF r.outstanding_approved > 0 THEN
      v_next := CASE WHEN r.approved_awaiting_parts > 0 THEN 'awaiting_parts' ELSE 'awaiting_repair' END;
    ELSIF r.declined_not_offered > 0 THEN
      v_next := 'repairs_declined';
    ELSIF r.declined_offered > 0 THEN
      v_next := 'pending_receiver_approval';
    ELSE
      v_next := 'repaired';
    END IF;

    IF v_next <> r.status THEN
      UPDATE public.bicycle_inspections
      SET status = v_next, updated_at = now()
      WHERE id = r.id;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'approved', v_approved, 'declined', v_declined);
END;
$$;