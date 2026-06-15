
-- =============================================================
-- 1. Brute-force throttle for the postcode verification endpoint
-- =============================================================
CREATE TABLE IF NOT EXISTS public.tracking_postcode_attempts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid NOT NULL,
  ip          text,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tracking_postcode_attempts_lookup
  ON public.tracking_postcode_attempts(order_id, ip, attempted_at DESC);

-- Only the SECURITY DEFINER RPCs (running as postgres) write here.
-- service_role gets full access for admin cleanup; no anon/authenticated grants.
GRANT ALL ON public.tracking_postcode_attempts TO service_role;

ALTER TABLE public.tracking_postcode_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read postcode attempts"
  ON public.tracking_postcode_attempts FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::user_role));

-- =============================================================
-- 2. Helper: normalise a UK-style postcode for comparison
-- =============================================================
CREATE OR REPLACE FUNCTION public._normalise_postcode(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p IS NULL THEN NULL
    ELSE lower(regexp_replace(p, '\s+', '', 'g'))
  END;
$$;

-- =============================================================
-- 3. Helper: build the sanitised public order payload.
--    p_reveal_side is NULL (default), 'sender' or 'receiver'.
--    Only events on the revealed side get podUrls/signatureUrl.
-- =============================================================
CREATE OR REPLACE FUNCTION public._build_public_order_payload(
  v_order public.orders,
  p_reveal_side text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender jsonb;
  v_receiver jsonb;
  v_inspection_summary jsonb;
  v_pickup_id text;
  v_delivery_id text;
  v_updates jsonb;
  v_events jsonb;
BEGIN
  -- Sender / receiver: name + city + country only. NO postcode, address lines,
  -- phone, email or GPS — postcode is reserved as the verification secret.
  v_sender := CASE WHEN v_order.sender IS NULL THEN NULL ELSE
    jsonb_strip_nulls(jsonb_build_object(
      'name',    v_order.sender->>'name',
      'city',    v_order.sender->>'city',
      'country', v_order.sender->>'country'
    ))
  END;

  v_receiver := CASE WHEN v_order.receiver IS NULL THEN NULL ELSE
    jsonb_strip_nulls(jsonb_build_object(
      'name',    v_order.receiver->>'name',
      'city',    v_order.receiver->>'city',
      'country', v_order.receiver->>'country'
    ))
  END;

  -- Sanitise the shipday updates array. Strip driverName, raw Shipday metadata,
  -- and conditionally hide podUrls / signatureUrl based on p_reveal_side.
  IF v_order.tracking_events IS NOT NULL AND v_order.tracking_events ? 'shipday' THEN
    v_pickup_id   := v_order.tracking_events->'shipday'->>'pickup_id';
    v_delivery_id := v_order.tracking_events->'shipday'->>'delivery_id';

    SELECT jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'event',        u->>'event',
        'orderId',      u->>'orderId',
        'timestamp',    u->>'timestamp',
        'description',  u->>'description',
        'leg',          u->>'leg',
        'has_pod',       (jsonb_typeof(u->'podUrls') = 'array' AND jsonb_array_length(u->'podUrls') > 0),
        'has_signature', (u->>'signatureUrl' IS NOT NULL AND length(u->>'signatureUrl') > 0),
        'podUrls', CASE
          WHEN p_reveal_side = 'sender'
               AND (u->>'leg' = 'pickup' OR (v_pickup_id IS NOT NULL AND u->>'orderId' = v_pickup_id))
            THEN u->'podUrls'
          WHEN p_reveal_side = 'receiver'
               AND (u->>'leg' = 'delivery' OR (v_delivery_id IS NOT NULL AND u->>'orderId' = v_delivery_id))
            THEN u->'podUrls'
          ELSE NULL
        END,
        'signatureUrl', CASE
          WHEN p_reveal_side = 'sender'
               AND (u->>'leg' = 'pickup' OR (v_pickup_id IS NOT NULL AND u->>'orderId' = v_pickup_id))
            THEN u->>'signatureUrl'
          WHEN p_reveal_side = 'receiver'
               AND (u->>'leg' = 'delivery' OR (v_delivery_id IS NOT NULL AND u->>'orderId' = v_delivery_id))
            THEN u->>'signatureUrl'
          ELSE NULL
        END
      ))
    )
    INTO v_updates
    FROM jsonb_array_elements(v_order.tracking_events->'shipday'->'updates') u;

    v_events := jsonb_build_object(
      'shipday', jsonb_build_object(
        'pickup_id',   v_pickup_id,
        'delivery_id', v_delivery_id,
        'updates',     COALESCE(v_updates, '[]'::jsonb)
      )
    );
  ELSE
    v_events := NULL;
  END IF;

  IF v_order.needs_inspection THEN
    v_inspection_summary := public.get_public_inspection_summary(
      COALESCE(v_order.tracking_number, v_order.id::text)
    );
  END IF;

  RETURN jsonb_build_object(
    'id',                              v_order.id,
    'user_id',                         NULL,
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
    'tracking_events',                 v_events,
    'bikes', CASE WHEN v_order.bikes IS NULL THEN NULL ELSE
      (SELECT jsonb_agg(jsonb_build_object(
        'brand',    b->>'brand',
        'model',    b->>'model',
        'type',     b->>'type',
        'quantity', b->>'quantity'
      )) FROM jsonb_array_elements(v_order.bikes) b)
    END,
    'sender_notes',                    v_order.sender_notes,
    'receiver_notes',                  v_order.receiver_notes,
    'inspection_summary',              v_inspection_summary,
    'revealed_side',                   p_reveal_side
  );
END;
$$;

-- =============================================================
-- 4. Default public lookup — no proof required, no PII or POD.
-- =============================================================
CREATE OR REPLACE FUNCTION public.get_public_order(p_identifier text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id_trim text;
  v_order public.orders%ROWTYPE;
BEGIN
  IF p_identifier IS NULL THEN
    RETURN NULL;
  END IF;
  v_id_trim := trim(p_identifier);
  IF length(v_id_trim) = 0 THEN
    RETURN NULL;
  END IF;

  IF v_id_trim ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT * INTO v_order FROM public.orders WHERE id::text = v_id_trim LIMIT 1;
  END IF;
  IF v_order.id IS NULL THEN
    SELECT * INTO v_order FROM public.orders
     WHERE lower(tracking_number) = lower(v_id_trim) LIMIT 1;
  END IF;
  IF v_order.id IS NULL THEN
    SELECT * INTO v_order FROM public.orders
     WHERE lower(customer_order_number) = lower(v_id_trim) LIMIT 1;
  END IF;

  IF v_order.id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN public._build_public_order_payload(v_order, NULL);
END;
$$;

-- =============================================================
-- 5. Verified lookup — postcode unlocks POD/signature for one side only.
-- =============================================================
CREATE OR REPLACE FUNCTION public.get_public_order_with_proof(
  p_identifier text,
  p_postcode   text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id_trim text;
  v_order public.orders%ROWTYPE;
  v_pc_input text;
  v_pc_sender text;
  v_pc_receiver text;
  v_reveal text := NULL;
  v_ip text;
  v_recent_attempts int;
  v_payload jsonb;
BEGIN
  IF p_identifier IS NULL OR p_postcode IS NULL THEN
    RETURN NULL;
  END IF;

  v_id_trim := trim(p_identifier);
  IF length(v_id_trim) = 0 THEN
    RETURN NULL;
  END IF;

  -- Resolve the order
  IF v_id_trim ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT * INTO v_order FROM public.orders WHERE id::text = v_id_trim LIMIT 1;
  END IF;
  IF v_order.id IS NULL THEN
    SELECT * INTO v_order FROM public.orders
     WHERE lower(tracking_number) = lower(v_id_trim) LIMIT 1;
  END IF;
  IF v_order.id IS NULL THEN
    SELECT * INTO v_order FROM public.orders
     WHERE lower(customer_order_number) = lower(v_id_trim) LIMIT 1;
  END IF;

  IF v_order.id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Rate-limit: 10 attempts / 10 minutes per (order, ip)
  BEGIN
    v_ip := split_part(
      COALESCE(current_setting('request.headers', true)::json->>'x-forwarded-for', ''),
      ',', 1
    );
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL;
  END;

  SELECT count(*) INTO v_recent_attempts
  FROM public.tracking_postcode_attempts
  WHERE order_id = v_order.id
    AND COALESCE(ip,'') = COALESCE(v_ip,'')
    AND attempted_at > now() - interval '10 minutes';

  IF v_recent_attempts >= 10 THEN
    v_payload := public._build_public_order_payload(v_order, NULL);
    RETURN v_payload || jsonb_build_object(
      'verification_failed', true,
      'rate_limited', true
    );
  END IF;

  INSERT INTO public.tracking_postcode_attempts(order_id, ip)
  VALUES (v_order.id, v_ip);

  -- Compare postcodes (whitespace-stripped, case-insensitive)
  v_pc_input    := public._normalise_postcode(p_postcode);
  v_pc_sender   := public._normalise_postcode(
    COALESCE(v_order.sender->>'postcode',
             v_order.sender->>'zipCode',
             v_order.sender->>'postal_code',
             v_order.sender->'address'->>'zipCode',
             v_order.sender->'address'->>'postcode',
             v_order.sender->'address'->>'postal_code')
  );
  v_pc_receiver := public._normalise_postcode(
    COALESCE(v_order.receiver->>'postcode',
             v_order.receiver->>'zipCode',
             v_order.receiver->>'postal_code',
             v_order.receiver->'address'->>'zipCode',
             v_order.receiver->'address'->>'postcode',
             v_order.receiver->'address'->>'postal_code')
  );

  IF v_pc_input IS NOT NULL AND v_pc_input = v_pc_sender THEN
    v_reveal := 'sender';
  ELSIF v_pc_input IS NOT NULL AND v_pc_input = v_pc_receiver THEN
    v_reveal := 'receiver';
  END IF;

  v_payload := public._build_public_order_payload(v_order, v_reveal);

  IF v_reveal IS NULL THEN
    RETURN v_payload || jsonb_build_object('verification_failed', true);
  END IF;

  RETURN v_payload;
END;
$$;

-- =============================================================
-- 6. Grants on the public RPCs (the table is already locked down).
-- =============================================================
REVOKE ALL ON FUNCTION public._build_public_order_payload(public.orders, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._build_public_order_payload(public.orders, text) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_public_order(text)                    TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_order_with_proof(text, text)   TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._normalise_postcode(text)                 TO anon, authenticated, service_role;
