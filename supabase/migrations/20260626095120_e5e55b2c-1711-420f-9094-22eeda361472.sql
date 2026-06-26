CREATE OR REPLACE FUNCTION public.set_order_availability(p_order_id uuid, p_side text, p_dates jsonb, p_notes text, p_postcode text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order          public.orders%ROWTYPE;
  v_needs_inspection boolean;
  v_new_status     text;
  v_auth_uid       uuid := auth.uid();
  v_auth_email     text;
  v_authorised     boolean := false;
  v_ip             text;
  v_recent_attempts int;
  v_pc_input       text;
  v_pc_side        text;
  v_anon_key       text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4aWd0cm1heGhldHlmempqZHZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE3NDA4MDMsImV4cCI6MjA1NzMxNjgwM30.POm5myoyMwKjkMfYMw2gRFs-cgD7GDznv338qiadugg';
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

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  IF v_auth_uid IS NOT NULL THEN
    IF v_order.user_id = v_auth_uid
       OR public.has_role(v_auth_uid, 'admin'::user_role)
       OR public.has_role(v_auth_uid, 'cs_agent'::user_role)
       OR public.has_role(v_auth_uid, 'route_planner'::user_role) THEN
      v_authorised := true;
    ELSE
      SELECT email INTO v_auth_email FROM auth.users WHERE id = v_auth_uid;
      IF v_auth_email IS NOT NULL THEN
        IF p_side = 'sender'   AND lower(v_order.sender->>'email')   = lower(v_auth_email) THEN
          v_authorised := true;
        ELSIF p_side = 'receiver' AND lower(v_order.receiver->>'email') = lower(v_auth_email) THEN
          v_authorised := true;
        END IF;
      END IF;
    END IF;
  END IF;

  IF NOT v_authorised THEN
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
      RAISE EXCEPTION 'Too many attempts, please try again later' USING ERRCODE = 'check_violation';
    END IF;

    INSERT INTO public.tracking_postcode_attempts(order_id, ip)
    VALUES (v_order.id, v_ip);

    v_pc_input := public._normalise_postcode(p_postcode);
    IF p_side = 'sender' THEN
      v_pc_side := public._normalise_postcode(
        COALESCE(v_order.sender->>'postcode',
                 v_order.sender->>'zipCode',
                 v_order.sender->>'postal_code',
                 v_order.sender->'address'->>'zipCode',
                 v_order.sender->'address'->>'postcode',
                 v_order.sender->'address'->>'postal_code')
      );
    ELSE
      v_pc_side := public._normalise_postcode(
        COALESCE(v_order.receiver->>'postcode',
                 v_order.receiver->>'zipCode',
                 v_order.receiver->>'postal_code',
                 v_order.receiver->'address'->>'zipCode',
                 v_order.receiver->'address'->>'postcode',
                 v_order.receiver->'address'->>'postal_code')
      );
    END IF;

    IF v_pc_input IS NULL OR v_pc_side IS NULL OR v_pc_input <> v_pc_side THEN
      RAISE EXCEPTION 'Postcode does not match' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  v_needs_inspection := v_order.needs_inspection;

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

    -- Server-side trigger of receiver availability email (best-effort, non-blocking).
    -- emailType MUST be 'receiver' to match send-email's publicEmailTypes
    -- allow-list and its template router. Previously 'receiver_availability'
    -- caused 401 Unauthorized and no email was sent.
    IF NOT v_needs_inspection
       AND v_order.receiver IS NOT NULL
       AND COALESCE(v_order.receiver->>'email','') <> '' THEN
      BEGIN
        PERFORM net.http_post(
          url := 'https://axigtrmaxhetyfzjjdve.supabase.co/functions/v1/send-email',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_anon_key,
            'apikey', v_anon_key
          ),
          body := jsonb_build_object(
            'to', v_order.receiver->>'email',
            'emailType', 'receiver',
            'name', COALESCE(v_order.receiver->>'name', 'Customer'),
            'orderId', v_order.id::text,
            'trackingNumber', v_order.tracking_number,
            'baseUrl', 'https://booking.cyclecourierco.com'
          )
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Failed to dispatch receiver availability email: %', SQLERRM;
      END;
    END IF;
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
$function$;