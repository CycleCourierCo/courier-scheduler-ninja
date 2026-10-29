-- Lock down EXECUTE grants on app-owned functions in the public schema.
-- Extension-owned functions (PostGIS etc.) are excluded via pg_depend membership.
-- Public keep-list: functions the signed-out website genuinely calls.
-- Full-revoke list: service-role/edge-only or trigger-only functions.
DO $$
DECLARE
  rec record;
  v_keep text[] := array[
    'set_order_availability',
    'get_ni_partner_job',
    'get_public_order',
    'get_public_order_with_proof',
    'get_public_repair_offer',
    'submit_public_repair_offer',
    'get_public_inspection_approval',
    'get_oauth_client_public',
    'verify_api_key',
    'verify_oauth_token',
    'resolve_oauth_token_grant'
  ];
  v_full_revoke text[] := array[
    'get_vault_secret',
    'get_cron_secret',
    'bike_builds_guard_customer_updates',
    'bike_builds_touch_updated_at',
    'apply_saved_route_assignment',
    'cancel_absences_on_deactivate',
    'apply_shipday_tracking',
    '_label_staff_role',
    'submit_inspection_approval_internal',
    'cleanup_expired_oauth',
    'create_webhook_secret',
    'next_custom_repair_id'
  ];
BEGIN
  FOR rec IN
    SELECT p.proname AS fname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.deptype = 'e' AND d.objid = p.oid
      )
  LOOP
    IF rec.fname = ANY(v_full_revoke) THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated', rec.fname, rec.args);
    ELSIF NOT (rec.fname = ANY(v_keep)) THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon', rec.fname, rec.args);
    END IF;
  END LOOP;
END;
$$;