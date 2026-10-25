
CREATE OR REPLACE FUNCTION public.can_see_fleet_warnings(_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid
    AND role::text IN ('admin','fleet_manager','route_planner','timeslip_admin','loader'))
$$;
REVOKE EXECUTE ON FUNCTION public.can_see_fleet_warnings(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_see_fleet_warnings(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fleet_vehicle_warnings(p_vehicle_ids uuid[])
RETURNS TABLE(vehicle_id uuid, registration text, level text, code text, message text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE today date := (now() AT TIME ZONE 'Europe/London')::date;
BEGIN
  IF NOT public.can_see_fleet_warnings(auth.uid()) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  RETURN QUERY
  WITH v AS (SELECT * FROM public.vehicles WHERE id = ANY(p_vehicle_ids))
  SELECT v.id, v.registration, 'red', 'out_of_service',
         'This van is marked ' || CASE WHEN v.status::text = 'off_road' THEN 'out of service' WHEN v.status::text IN ('in_repair','in_service') THEN 'under repair' ELSE 'retired' END || '. Do not use it unless the fleet manager has confirmed it is safe and legal.'
    FROM v WHERE v.status::text IN ('off_road','in_repair','in_service','sold','written_off')
  UNION ALL
  SELECT v.id, v.registration, 'red', 'critical_defect:' || i.id,
         'Critical defect open: ' || i.title || '. Confirm the van has been assessed and is safe and legal before it is used.'
    FROM v JOIN public.vehicle_issues i ON i.vehicle_id = v.id
    WHERE i.severity = 'high' AND i.status NOT IN ('resolved','cancelled')
  UNION ALL
  SELECT v.id, v.registration, 'amber', 'mot_expired', 'MOT expired on ' || to_char(v.mot_expiry_date, 'DD Mon YYYY') || '.'
    FROM v WHERE v.mot_expiry_date IS NOT NULL AND v.mot_expiry_date < today
  UNION ALL
  SELECT v.id, v.registration, 'amber', 'tax_expired', 'Road tax was due on ' || to_char(v.tax_due_date, 'DD Mon YYYY') || '.'
    FROM v WHERE v.tax_due_date IS NOT NULL AND v.tax_due_date < today
  UNION ALL
  SELECT v.id, v.registration, 'amber', 'no_insurance', 'No current insurance policy is recorded for this van.'
    FROM v WHERE v.status::text NOT IN ('sold','written_off')
      AND NOT EXISTS (SELECT 1 FROM public.vehicle_insurance_policies p WHERE p.vehicle_id = v.id AND p.start_date <= today AND p.end_date >= today)
  UNION ALL
  SELECT v.id, v.registration, 'amber', 'inspection_overdue', 'Safety inspection overdue since ' || to_char(v.next_inspection_due, 'DD Mon YYYY') || '.'
    FROM v WHERE v.next_inspection_due IS NOT NULL AND v.next_inspection_due < today
  UNION ALL
  SELECT v.id, v.registration, 'amber', 'maintenance_required', 'This van is marked as needing maintenance.'
    FROM v WHERE v.status::text = 'in_use_maintenance_required'
  UNION ALL
  SELECT v.id, v.registration, 'amber', 'amber_defect:' || i.id, 'Defect to fix soon: ' || i.title || '.'
    FROM v JOIN public.vehicle_issues i ON i.vehicle_id = v.id
    WHERE i.severity = 'medium' AND i.status NOT IN ('resolved','cancelled')
  UNION ALL
  SELECT v.id, v.registration, 'grey', 'open_items',
         count(*)::text || ' other open item(s) (minor defects or repairs in progress).'
    FROM v JOIN (
      SELECT i.vehicle_id FROM public.vehicle_issues i WHERE i.severity = 'low' AND i.status NOT IN ('resolved','cancelled')
      UNION ALL SELECT j.vehicle_id FROM public.fleet_repair_jobs j WHERE j.status NOT IN ('verified','closed','cancelled')
    ) o ON o.vehicle_id = v.id
    GROUP BY v.id, v.registration;
END $$;
REVOKE EXECUTE ON FUNCTION public.fleet_vehicle_warnings(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fleet_vehicle_warnings(uuid[]) TO authenticated, service_role;

CREATE TABLE public.fleet_route_warning_acks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  context text NOT NULL,
  warning_codes text[] NOT NULL DEFAULT '{}',
  acknowledged_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.fleet_route_warning_acks TO authenticated;
GRANT ALL ON public.fleet_route_warning_acks TO service_role;
ALTER TABLE public.fleet_route_warning_acks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Fleet staff read warning acks" ON public.fleet_route_warning_acks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.is_fleet_staff(s.uid)));
CREATE POLICY "Planners record their own acks" ON public.fleet_route_warning_acks FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE s.uid = acknowledged_by AND public.can_see_fleet_warnings(s.uid)));

-- Fleet alert emails (editable in the Email Centre)
INSERT INTO public.email_templates (key, name, category, audience, trigger_label, recipients, locked, wording_mode) VALUES
 ('internal.fleet_critical_defect','Fleet: new critical defect','internal','internal','When a red defect is raised','["fleet managers","admins"]',false,'intro'),
 ('internal.fleet_defect_assigned','Fleet: defect assigned to you','internal','internal','When a defect is assigned','["assigned person"]',false,'intro'),
 ('internal.fleet_repair_verify','Fleet: repair awaiting verification','internal','internal','When a repair job is completed','["fleet managers","admins"]',false,'intro'),
 ('internal.fleet_daily_digest','Fleet: daily overdue list','internal','internal','Every morning at 7am','["fleet managers","admins"]',false,'intro')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.fleet_notify(p_action text, p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://axigtrmaxhetyfzjjdve.supabase.co/functions/v1/fleet-alerts',
    headers := jsonb_build_object('Content-Type','application/json','X-Cron-Secret', get_cron_secret()),
    body := jsonb_build_object('action', p_action, 'id', p_id)
  );
EXCEPTION WHEN OTHERS THEN NULL; -- never block a save because an alert couldn't be queued
END $$;
REVOKE ALL ON FUNCTION public.fleet_notify(text, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fleet_alert_triggers() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'vehicle_issues' THEN
    IF NEW.severity = 'high' AND NEW.status NOT IN ('resolved','cancelled')
       AND (TG_OP = 'INSERT' OR OLD.severity <> 'high') THEN
      PERFORM public.fleet_notify('critical_defect', NEW.id);
    END IF;
    IF NEW.assigned_to IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
      PERFORM public.fleet_notify('defect_assigned', NEW.id);
    END IF;
  ELSIF TG_TABLE_NAME = 'fleet_repair_jobs' THEN
    IF NEW.status IN ('completed','invoiced') AND (TG_OP = 'INSERT' OR OLD.status NOT IN ('completed','invoiced')) THEN
      PERFORM public.fleet_notify('repair_verify', NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.fleet_alert_triggers() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER fleet_alerts AFTER INSERT OR UPDATE ON public.vehicle_issues FOR EACH ROW EXECUTE FUNCTION public.fleet_alert_triggers();
CREATE TRIGGER fleet_alerts AFTER INSERT OR UPDATE ON public.fleet_repair_jobs FOR EACH ROW EXECUTE FUNCTION public.fleet_alert_triggers();

CREATE OR REPLACE FUNCTION public.invoke_fleet_daily_digest() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.fleet_notify('digest', NULL); END $$;
REVOKE ALL ON FUNCTION public.invoke_fleet_daily_digest() FROM PUBLIC, anon, authenticated;
-- 06:00 and 07:00 UTC; the function only sends at 7am London time.
SELECT cron.schedule('fleet-daily-digest', '0 6,7 * * *', $$SELECT public.invoke_fleet_daily_digest();$$);
