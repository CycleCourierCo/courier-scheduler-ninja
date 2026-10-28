CREATE OR REPLACE FUNCTION public.trigger_order_webhook()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  webhook_event text;
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4aWd0cm1heGhldHlmempqZHZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE3NDA4MDMsImV4cCI6MjA1NzMxNjgwM30.POm5myoyMwKjkMfYMw2gRFs-cgD7GDznv338qiadugg';
BEGIN
  webhook_event := get_webhook_event_for_status(NEW.status::text, OLD.status::text);
  IF webhook_event IS NOT NULL THEN
    PERFORM net.http_post(
      url := 'https://axigtrmaxhetyfzjjdve.supabase.co/functions/v1/trigger-webhook',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key,
        'apikey', anon_key,
        'X-Cron-Secret', public.get_cron_secret()
      ),
      body := jsonb_build_object('order_id', NEW.id::text, 'event_type', webhook_event)
    );
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.trigger_order_webhook() FROM PUBLIC, anon, authenticated;

-- Staff with a role beyond driver/loader may read driver/loader profiles; drivers and loaders no longer see colleagues' pay.
CREATE OR REPLACE FUNCTION public.is_office_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id
    AND role IN ('admin','cs_agent','route_planner','sales','timeslip_admin','mechanic','project_manager','fleet_manager','tech'))
$$;
REVOKE EXECUTE ON FUNCTION public.is_office_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_office_staff(uuid) TO authenticated;

DROP POLICY IF EXISTS "Internal staff can read driver/loader profiles" ON public.profiles;
CREATE POLICY "Office staff can read driver/loader profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_office_staff((SELECT auth.uid())) AND role = ANY (ARRAY['driver'::user_role, 'loader'::user_role]));

-- Names/contact only, for loaders' Loading page.
CREATE OR REPLACE FUNCTION public.loading_staff_directory(p_role text)
RETURNS TABLE(id uuid, name text, phone text, email text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_internal_staff(auth.uid()) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF p_role NOT IN ('driver','loader') THEN RAISE EXCEPTION 'Invalid role'; END IF;
  RETURN QUERY SELECT p.id, p.name::text, p.phone::text, p.email::text FROM public.profiles p
    WHERE p.role::text = p_role
      AND (p.is_active IS NULL OR p.is_active)
      AND (p.account_status IS NULL OR p.account_status::text NOT IN ('suspended','rejected'))
    ORDER BY p.name;
END $$;
REVOKE EXECUTE ON FUNCTION public.loading_staff_directory(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.loading_staff_directory(text) TO authenticated;