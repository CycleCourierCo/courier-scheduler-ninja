
-- =========================================================================
-- 1. Least-privilege: revoke EXECUTE on internal helpers from anon
-- =========================================================================

-- Vault / cron secret helpers: service_role only
REVOKE EXECUTE ON FUNCTION public.get_vault_secret(text)            FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_cron_secret()                 FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_webhook_secret(text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_vault_secret(text)            TO service_role;
GRANT  EXECUTE ON FUNCTION public.get_cron_secret()                 TO service_role;
GRANT  EXECUTE ON FUNCTION public.create_webhook_secret(text, text) TO service_role;

-- Cron invokers: called only by pg_cron (superuser); service_role only
REVOKE EXECUTE ON FUNCTION public.invoke_generate_timeslips()              FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.invoke_process_scheduled_announcements() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.invoke_refresh_vehicles()                FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.invoke_fuel_finder_refresh()             FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.invoke_generate_timeslips()              TO service_role;
GRANT  EXECUTE ON FUNCTION public.invoke_process_scheduled_announcements() TO service_role;
GRANT  EXECUTE ON FUNCTION public.invoke_refresh_vehicles()                TO service_role;
GRANT  EXECUTE ON FUNCTION public.invoke_fuel_finder_refresh()             TO service_role;

-- API key verification: service_role only (edge functions)
REVOKE EXECUTE ON FUNCTION public.verify_api_key(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.verify_api_key(text) TO service_role;

-- Admin wrappers + role lookups: authenticated + service_role only
REVOKE EXECUTE ON FUNCTION public.admin_generate_api_key(uuid, text)                                FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_generate_webhook_secret(uuid, text, text, text[])           FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_revoke_api_key(uuid)                                        FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_revoke_webhook(uuid)                                        FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_update_account_status(uuid, text)                           FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_business_accounts_for_admin()                                 FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_business_opening_hours(uuid[])                                FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid)                                               FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_internal_users()                                             FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_pending_availability_orders()                              FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_generate_api_key(uuid, text)                                 TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_generate_webhook_secret(uuid, text, text, text[])            TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_revoke_api_key(uuid)                                         TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_revoke_webhook(uuid)                                         TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_account_status(uuid, text)                            TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_business_accounts_for_admin()                                  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_business_opening_hours(uuid[])                                 TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid)                                                TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_internal_users()                                              TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_pending_availability_orders()                               TO authenticated, service_role;

-- =========================================================================
-- 2. set_order_availability: gate anonymous callers behind postcode check
-- =========================================================================
-- Authenticated callers who are the order owner or whose email matches the
-- sender/receiver continue to work without a postcode (Bulk Availability page,
-- admin testing). Anonymous callers (email/SMS deep-link) must supply the
-- postcode matching the side they're updating. Rate-limited via the existing
-- tracking_postcode_attempts table.

DROP FUNCTION IF EXISTS public.set_order_availability(uuid, text, jsonb, text);

CREATE OR REPLACE FUNCTION public.set_order_availability(
  p_order_id uuid,
  p_side text,
  p_dates jsonb,
  p_notes text,
  p_postcode text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order          public.orders%ROWTYPE;
  v_needs_inspection boolean;
  v_other_confirmed_at timestamptz;
  v_new_status     text;
  v_auth_uid       uuid := auth.uid();
  v_auth_email     text;
  v_authorised     boolean := false;
  v_ip             text;
  v_recent_attempts int;
  v_pc_input       text;
  v_pc_side        text;
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

  -- Authenticated bypass: order owner, internal staff, or email matches the
  -- side being updated.
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

  -- Anonymous / non-matching auth user: require postcode of the side being updated
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

REVOKE EXECUTE ON FUNCTION public.set_order_availability(uuid, text, jsonb, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.set_order_availability(uuid, text, jsonb, text, text) TO anon, authenticated, service_role;
