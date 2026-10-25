CREATE OR REPLACE FUNCTION public.is_fleet_staff(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role::text IN ('admin','fleet_manager'))
$$;
REVOKE EXECUTE ON FUNCTION public.is_fleet_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_fleet_staff(uuid) TO authenticated, service_role;

DO $$
DECLARE t text; op text;
BEGIN
  FOREACH t IN ARRAY ARRAY['vehicles','vehicle_maintenance_logs','vehicle_maintenance_intervals'] LOOP
    FOREACH op IN ARRAY ARRAY['select','insert','update','delete'] LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_'||op||'_policy', t);
    END LOOP;
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.is_fleet_staff(s.uid)))', t||'_select_policy', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.is_fleet_staff(s.uid)))', t||'_insert_policy', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.is_fleet_staff(s.uid))) WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.is_fleet_staff(s.uid)))', t||'_update_policy', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.is_fleet_staff(s.uid)))', t||'_delete_policy', t);
  END LOOP;
  FOREACH op IN ARRAY ARRAY['select','insert','update','delete'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.vehicle_insurance_policies', 'vehicle_insurance_policies_'||op);
  END LOOP;
END $$;
CREATE POLICY vehicle_insurance_policies_select ON public.vehicle_insurance_policies FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.is_fleet_staff(s.uid)));
CREATE POLICY vehicle_insurance_policies_insert ON public.vehicle_insurance_policies FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.is_fleet_staff(s.uid)));
CREATE POLICY vehicle_insurance_policies_update ON public.vehicle_insurance_policies FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.is_fleet_staff(s.uid))) WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.is_fleet_staff(s.uid)));
CREATE POLICY vehicle_insurance_policies_delete ON public.vehicle_insurance_policies FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.is_fleet_staff(s.uid)));

CREATE TABLE public.vehicle_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  severity text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  reported_by uuid DEFAULT auth.uid(),
  resolved_at timestamptz,
  resolved_by uuid,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vehicle_issues_vehicle_idx ON public.vehicle_issues(vehicle_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_issues TO authenticated;
GRANT ALL ON public.vehicle_issues TO service_role;
ALTER TABLE public.vehicle_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Fleet staff manage vehicle issues" ON public.vehicle_issues FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.is_fleet_staff(s.uid)))
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.is_fleet_staff(s.uid)));

CREATE OR REPLACE FUNCTION public.vehicle_issues_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TRIGGER vehicle_issues_touch BEFORE UPDATE ON public.vehicle_issues FOR EACH ROW EXECUTE FUNCTION public.vehicle_issues_touch();