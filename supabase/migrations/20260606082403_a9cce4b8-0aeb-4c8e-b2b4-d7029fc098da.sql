
ALTER TABLE public.vehicles 
  ADD COLUMN IF NOT EXISTS odometer_baseline_mi integer NOT NULL DEFAULT 0;

DO $$ BEGIN
  CREATE TYPE public.vehicle_service_type AS ENUM ('oil_filter', 'tyre', 'brake_pads', 'brake_discs', 'other');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.vehicle_service_position AS ENUM ('front_left', 'front_right', 'rear_left', 'rear_right', 'spare', 'front_axle', 'rear_axle');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE public.vehicle_maintenance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  service_type public.vehicle_service_type NOT NULL,
  custom_name text,
  position public.vehicle_service_position,
  service_date date NOT NULL,
  odometer_mi integer,
  cost numeric,
  vendor text,
  notes text,
  brand text,
  model text,
  part_number text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_maintenance_logs TO authenticated;
GRANT ALL ON public.vehicle_maintenance_logs TO service_role;

ALTER TABLE public.vehicle_maintenance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY vehicle_maintenance_logs_select_policy
  ON public.vehicle_maintenance_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin'::user_role)));

CREATE POLICY vehicle_maintenance_logs_insert_policy
  ON public.vehicle_maintenance_logs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin'::user_role)));

CREATE POLICY vehicle_maintenance_logs_update_policy
  ON public.vehicle_maintenance_logs FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin'::user_role)))
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin'::user_role)));

CREATE POLICY vehicle_maintenance_logs_delete_policy
  ON public.vehicle_maintenance_logs FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin'::user_role)));

CREATE INDEX vehicle_maintenance_logs_vehicle_idx ON public.vehicle_maintenance_logs(vehicle_id, service_date DESC);

CREATE TRIGGER set_vehicle_maintenance_logs_updated_at
  BEFORE UPDATE ON public.vehicle_maintenance_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.vehicle_maintenance_intervals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  service_type public.vehicle_service_type NOT NULL,
  position public.vehicle_service_position,
  custom_name text,
  interval_miles integer,
  interval_months integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_maintenance_intervals TO authenticated;
GRANT ALL ON public.vehicle_maintenance_intervals TO service_role;

ALTER TABLE public.vehicle_maintenance_intervals ENABLE ROW LEVEL SECURITY;

CREATE POLICY vehicle_maintenance_intervals_select_policy
  ON public.vehicle_maintenance_intervals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin'::user_role)));

CREATE POLICY vehicle_maintenance_intervals_insert_policy
  ON public.vehicle_maintenance_intervals FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin'::user_role)));

CREATE POLICY vehicle_maintenance_intervals_update_policy
  ON public.vehicle_maintenance_intervals FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin'::user_role)))
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin'::user_role)));

CREATE POLICY vehicle_maintenance_intervals_delete_policy
  ON public.vehicle_maintenance_intervals FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin'::user_role)));

CREATE INDEX vehicle_maintenance_intervals_vehicle_idx ON public.vehicle_maintenance_intervals(vehicle_id);

CREATE TRIGGER set_vehicle_maintenance_intervals_updated_at
  BEFORE UPDATE ON public.vehicle_maintenance_intervals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
