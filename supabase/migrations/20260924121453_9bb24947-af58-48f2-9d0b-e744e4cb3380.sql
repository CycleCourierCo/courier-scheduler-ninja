CREATE OR REPLACE FUNCTION public.guard_inspection_receiver_wait_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_declined_not_offered integer := 0;
  v_declined_offered integer := 0;
BEGIN
  IF NEW.order_id IS NULL
     OR COALESCE(NEW.approval_recipient, 'customer') IN ('receiver', 'walkin')
     OR NEW.status NOT IN ('awaiting_parts', 'awaiting_repair', 'in_repair', 'cleaning', 'repaired', 'ship_as_is') THEN
    RETURN NEW;
  END IF;

  SELECT
    COUNT(*) FILTER (
      WHERE i.status = 'declined'
        AND i.receiver_declined_at IS NULL
        AND i.offered_to_receiver_at IS NULL
    ),
    COUNT(*) FILTER (
      WHERE i.status = 'declined'
        AND i.receiver_declined_at IS NULL
        AND i.offered_to_receiver_at IS NOT NULL
    )
  INTO v_declined_not_offered, v_declined_offered
  FROM public.inspection_issues i
  WHERE i.inspection_id = NEW.id;

  IF v_declined_not_offered > 0 THEN
    NEW.status := 'repairs_declined';
  ELSIF v_declined_offered > 0 THEN
    NEW.status := 'pending_receiver_approval';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_inspection_receiver_wait_status ON public.bicycle_inspections;
CREATE TRIGGER guard_inspection_receiver_wait_status
BEFORE UPDATE OF status ON public.bicycle_inspections
FOR EACH ROW
EXECUTE FUNCTION public.guard_inspection_receiver_wait_status();

CREATE OR REPLACE FUNCTION public.submit_public_inspection_approval(p_inspection_id uuid, p_approved_issue_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_insp public.bicycle_inspections;
  v_approved integer := 0;
  v_declined integer := 0;
  v_onward boolean;
  v_approved_awaiting_parts integer := 0;
  v_next text;
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

  SELECT COUNT(*)
  INTO v_approved_awaiting_parts
  FROM public.inspection_issues i
  WHERE i.inspection_id = v_insp.id
    AND i.status = 'approved'
    AND NOT (
      i.parts_in_stock IS TRUE
      OR (i.parts_arrived IS TRUE AND i.parts_ordered IS TRUE)
    );

  v_next := CASE
    WHEN v_declined > 0 AND v_onward THEN 'repairs_declined'
    WHEN v_approved > 0 AND v_approved_awaiting_parts > 0 THEN 'awaiting_parts'
    WHEN v_approved > 0 THEN 'awaiting_repair'
    WHEN v_declined > 0 THEN 'ship_as_is'
    ELSE v_insp.status
  END;

  UPDATE public.bicycle_inspections
  SET status = v_next, updated_at = now()
  WHERE id = v_insp.id;

  RETURN jsonb_build_object('success', true, 'approved', v_approved, 'declined', v_declined);
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_public_repair_offer(p_order_id uuid, p_approved_issue_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_approved integer := 0;
  v_declined integer := 0;
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
  SET receiver_declined_at = now(), updated_at = now()
  WHERE i.order_id = p_order_id
    AND i.status = 'declined'
    AND i.offered_to_receiver_at IS NOT NULL
    AND i.receiver_declined_at IS NULL
    AND NOT (i.id = ANY(COALESCE(p_approved_issue_ids, ARRAY[]::uuid[])));
  GET DIAGNOSTICS v_declined = ROW_COUNT;

  FOR r IN
    SELECT ins.id,
           ins.status,
           COUNT(*) FILTER (WHERE i.status = 'approved') AS outstanding_approved,
           COUNT(*) FILTER (WHERE i.status IN ('approved', 'resolved', 'repaired')) AS any_approved,
           COUNT(*) FILTER (WHERE i.status = 'declined') AS any_declined,
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
      AND ins.status IN ('issues_found', 'repairs_declined', 'pending_receiver_approval', 'awaiting_parts', 'awaiting_repair', 'in_repair', 'ship_as_is')
    GROUP BY ins.id, ins.status
  LOOP
    IF r.declined_not_offered > 0 THEN
      v_next := 'repairs_declined';
    ELSIF r.declined_offered > 0 THEN
      v_next := 'pending_receiver_approval';
    ELSIF r.outstanding_approved > 0 THEN
      v_next := CASE WHEN r.approved_awaiting_parts > 0 THEN 'awaiting_parts' ELSE 'awaiting_repair' END;
    ELSIF r.any_approved = 0 AND r.any_declined > 0 THEN
      v_next := 'ship_as_is';
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