ALTER TYPE public.vehicle_status ADD VALUE IF NOT EXISTS 'in_use_maintenance_required';

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS vin text,
  ADD COLUMN IF NOT EXISTS vehicle_type text,
  ADD COLUMN IF NOT EXISTS assigned_driver_id uuid,
  ADD COLUMN IF NOT EXISTS maintenance_notes text,
  ADD COLUMN IF NOT EXISTS next_inspection_due date;

CREATE TABLE public.fleet_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  table_name text NOT NULL,
  record_id uuid,
  action text NOT NULL,
  changes jsonb,
  actor_id uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fleet_audit_log_vehicle_idx ON public.fleet_audit_log(vehicle_id, created_at DESC);
GRANT SELECT ON public.fleet_audit_log TO authenticated;
GRANT ALL ON public.fleet_audit_log TO service_role;
ALTER TABLE public.fleet_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Fleet staff read audit log" ON public.fleet_audit_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.is_fleet_staff(s.uid)));

CREATE OR REPLACE FUNCTION public.fleet_audit_trigger() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row jsonb := to_jsonb(COALESCE(NEW, OLD));
  v_vehicle uuid;
  v_action text := lower(TG_OP);
  v_changes jsonb;
BEGIN
  v_vehicle := CASE WHEN TG_TABLE_NAME = 'vehicles' THEN (v_row->>'id')::uuid ELSE (v_row->>'vehicle_id')::uuid END;
  IF TG_OP = 'UPDATE' THEN
    SELECT jsonb_object_agg(n.key, jsonb_build_object('from', o.value, 'to', n.value))
      INTO v_changes
      FROM jsonb_each(to_jsonb(NEW)) n JOIN jsonb_each(to_jsonb(OLD)) o USING (key)
     WHERE n.value IS DISTINCT FROM o.value AND n.key NOT IN ('updated_at','ves_raw','last_refreshed_at');
    IF v_changes IS NULL THEN RETURN NEW; END IF;
    IF TG_TABLE_NAME = 'vehicles' AND v_changes ? 'status' THEN v_action := 'status_changed'; END IF;
  ELSIF TG_OP = 'INSERT' THEN v_changes := v_row;
  ELSE v_changes := v_row;
  END IF;
  INSERT INTO public.fleet_audit_log(vehicle_id, table_name, record_id, action, changes)
  VALUES (CASE WHEN TG_OP='DELETE' AND TG_TABLE_NAME='vehicles' THEN NULL ELSE v_vehicle END,
          TG_TABLE_NAME, (v_row->>'id')::uuid, v_action, v_changes);
  RETURN COALESCE(NEW, OLD);
END $$;
REVOKE EXECUTE ON FUNCTION public.fleet_audit_trigger() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER fleet_audit AFTER INSERT OR UPDATE OR DELETE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.fleet_audit_trigger();
CREATE TRIGGER fleet_audit AFTER INSERT OR UPDATE OR DELETE ON public.vehicle_issues FOR EACH ROW EXECUTE FUNCTION public.fleet_audit_trigger();
CREATE TRIGGER fleet_audit AFTER INSERT OR UPDATE OR DELETE ON public.vehicle_odometer_readings FOR EACH ROW EXECUTE FUNCTION public.fleet_audit_trigger();
CREATE TRIGGER fleet_audit AFTER INSERT OR UPDATE OR DELETE ON public.vehicle_maintenance_logs FOR EACH ROW EXECUTE FUNCTION public.fleet_audit_trigger();
CREATE TRIGGER fleet_audit AFTER INSERT OR UPDATE OR DELETE ON public.vehicle_maintenance_intervals FOR EACH ROW EXECUTE FUNCTION public.fleet_audit_trigger();