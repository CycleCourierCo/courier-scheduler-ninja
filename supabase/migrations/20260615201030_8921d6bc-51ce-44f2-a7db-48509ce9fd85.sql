
-- 1. Drop unsafe policies
DROP POLICY IF EXISTS orders_public_tracking_select_policy ON public.orders;
DROP POLICY IF EXISTS orders_authenticated_public_select_policy ON public.orders;
DROP POLICY IF EXISTS "Orders UPDATE for users and availability" ON public.orders;

-- 2. Revoke direct anon access (RLS would already block, but defense-in-depth)
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.orders FROM anon;

-- 3. Add scoped UPDATE policies (admin + owner). route_planner / loader policies already exist.
CREATE POLICY orders_admin_update_policy ON public.orders
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin'::user_role)))
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin'::user_role)));

CREATE POLICY orders_owner_update_policy ON public.orders
  FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- 4. Public sanitised order fetch (used by tracking + availability pages).
--    SECURITY DEFINER lets it bypass RLS, but we whitelist columns and strip PII from JSONB.
CREATE OR REPLACE FUNCTION public.get_public_order(p_identifier text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_sender jsonb;
  v_receiver jsonb;
  v_inspection_summary jsonb;
BEGIN
  IF p_identifier IS NULL OR length(p_identifier) = 0 THEN
    RETURN NULL;
  END IF;

  -- UUID exact match
  IF p_identifier ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT * INTO v_order FROM public.orders WHERE id::text = p_identifier LIMIT 1;
  END IF;

  IF v_order.id IS NULL THEN
    SELECT * INTO v_order FROM public.orders WHERE tracking_number = p_identifier LIMIT 1;
  END IF;

  IF v_order.id IS NULL THEN
    SELECT * INTO v_order FROM public.orders WHERE customer_order_number = p_identifier LIMIT 1;
  END IF;

  IF v_order.id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Sanitise sender / receiver JSONB: keep only name, city, postcode, country.
  -- Drop address lines, phone, email, GPS coordinates and any other PII.
  v_sender := CASE WHEN v_order.sender IS NULL THEN NULL ELSE
    jsonb_strip_nulls(jsonb_build_object(
      'name',     v_order.sender->>'name',
      'city',     v_order.sender->>'city',
      'postcode', COALESCE(v_order.sender->>'postcode', v_order.sender->>'zipCode', v_order.sender->>'postal_code'),
      'country',  v_order.sender->>'country'
    ))
  END;

  v_receiver := CASE WHEN v_order.receiver IS NULL THEN NULL ELSE
    jsonb_strip_nulls(jsonb_build_object(
      'name',     v_order.receiver->>'name',
      'city',     v_order.receiver->>'city',
      'postcode', COALESCE(v_order.receiver->>'postcode', v_order.receiver->>'zipCode', v_order.receiver->>'postal_code'),
      'country',  v_order.receiver->>'country'
    ))
  END;

  -- Optional inspection summary for the public tracking timeline
  IF v_order.needs_inspection THEN
    v_inspection_summary := public.get_public_inspection_summary(COALESCE(v_order.tracking_number, v_order.id::text));
  END IF;

  RETURN jsonb_build_object(
    'id',                              v_order.id,
    'user_id',                         NULL, -- never expose owner uid publicly
    'sender',                          v_sender,
    'receiver',                        v_receiver,
    'status',                          v_order.status,
    'created_at',                      v_order.created_at,
    'updated_at',                      v_order.updated_at,
    'tracking_number',                 v_order.tracking_number,
    'bike_brand',                      v_order.bike_brand,
    'bike_model',                      v_order.bike_model,
    'bike_type',                       v_order.bike_type,
    'bike_quantity',                   v_order.bike_quantity,
    'customer_order_number',           v_order.customer_order_number,
    'is_bike_swap',                    v_order.is_bike_swap,
    'is_ebay_order',                   v_order.is_ebay_order,
    'needs_inspection',                v_order.needs_inspection,
    'pickup_date',                     v_order.pickup_date,
    'delivery_date',                   v_order.delivery_date,
    'scheduled_pickup_date',           v_order.scheduled_pickup_date,
    'scheduled_delivery_date',         v_order.scheduled_delivery_date,
    'scheduled_at',                    v_order.scheduled_at,
    'sender_confirmed_at',             v_order.sender_confirmed_at,
    'receiver_confirmed_at',           v_order.receiver_confirmed_at,
    'pickup_timeslot',                 v_order.pickup_timeslot,
    'delivery_timeslot',               v_order.delivery_timeslot,
    'collection_confirmation_sent_at', v_order.collection_confirmation_sent_at,
    'delivery_confirmation_sent_at',   v_order.delivery_confirmation_sent_at,
    'order_collected',                 v_order.order_collected,
    'order_delivered',                 v_order.order_delivered,
    'tracking_events',                 v_order.tracking_events,
    'bikes',                           CASE WHEN v_order.bikes IS NULL THEN NULL ELSE
      (SELECT jsonb_agg(jsonb_build_object(
        'brand',    b->>'brand',
        'model',    b->>'model',
        'type',     b->>'type',
        'quantity', b->>'quantity'
      )) FROM jsonb_array_elements(v_order.bikes) b)
    END,
    'sender_notes',                    v_order.sender_notes,
    'receiver_notes',                  v_order.receiver_notes,
    'inspection_summary',              v_inspection_summary
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_order(text) TO anon, authenticated;

-- 5. Whitelisted availability write. Used by anonymous sender/receiver pages.
--    Atomically sets dates, notes, confirmation timestamp, and final status.
CREATE OR REPLACE FUNCTION public.set_order_availability(
  p_order_id uuid,
  p_side text,
  p_dates jsonb,
  p_notes text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_needs_inspection boolean;
  v_other_confirmed_at timestamptz;
  v_new_status text;
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'order_id required';
  END IF;
  IF p_side NOT IN ('sender','receiver') THEN
    RAISE EXCEPTION 'invalid side';
  END IF;
  IF p_dates IS NULL OR jsonb_typeof(p_dates) <> 'array' OR jsonb_array_length(p_dates) = 0 THEN
    RAISE EXCEPTION 'dates required';
  END IF;

  SELECT needs_inspection,
         CASE WHEN p_side = 'sender' THEN receiver_confirmed_at ELSE sender_confirmed_at END
    INTO v_needs_inspection, v_other_confirmed_at
  FROM public.orders WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  IF p_side = 'sender' THEN
    v_new_status := CASE WHEN v_needs_inspection THEN 'sender_availability_confirmed'
                         ELSE 'receiver_availability_pending' END;
    UPDATE public.orders
       SET pickup_date         = p_dates,
           sender_notes        = NULLIF(trim(coalesce(p_notes,'')), ''),
           sender_confirmed_at = now(),
           status              = v_new_status::order_status,
           updated_at          = now()
     WHERE id = p_order_id;
  ELSE
    v_new_status := 'scheduled_dates_pending';
    UPDATE public.orders
       SET delivery_date         = p_dates,
           receiver_notes        = NULLIF(trim(coalesce(p_notes,'')), ''),
           receiver_confirmed_at = now(),
           status                = v_new_status::order_status,
           updated_at            = now()
     WHERE id = p_order_id;
  END IF;

  RETURN public.get_public_order(p_order_id::text);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_order_availability(uuid, text, jsonb, text) TO anon, authenticated;

-- 6. Bulk availability lookup for the signed-in user.
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

  SELECT COALESCE(jsonb_agg(public.get_public_order(o.id::text)), '[]'::jsonb)
    INTO v_result
  FROM public.orders o
  WHERE o.status NOT IN ('delivered','cancelled')
    AND (
      (lower(o.sender->>'email')   = lower(v_email) AND o.sender_confirmed_at   IS NULL)
   OR (lower(o.receiver->>'email') = lower(v_email) AND o.receiver_confirmed_at IS NULL)
    );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_pending_availability_orders() TO authenticated;
