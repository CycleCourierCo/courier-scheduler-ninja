
CREATE OR REPLACE FUNCTION public.get_my_pending_availability_orders()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF v_email IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(entry), '[]'::jsonb)
    INTO v_result
  FROM (
    SELECT jsonb_build_object(
             'role', 'sender',
             'order', public.get_public_order(o.id::text)
           ) AS entry
    FROM public.orders o
    WHERE o.status NOT IN ('delivered','cancelled')
      AND lower(o.sender->>'email') = lower(v_email)
      AND o.sender_confirmed_at IS NULL
    UNION ALL
    SELECT jsonb_build_object(
             'role', 'receiver',
             'order', public.get_public_order(o.id::text)
           )
    FROM public.orders o
    WHERE o.status NOT IN ('delivered','cancelled')
      AND lower(o.receiver->>'email') = lower(v_email)
      AND o.receiver_confirmed_at IS NULL
  ) s;

  RETURN v_result;
END;
$$;
