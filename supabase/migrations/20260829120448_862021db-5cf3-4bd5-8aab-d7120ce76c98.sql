CREATE TYPE public.equipment_unit_status AS ENUM ('available','assigned','in_repair','lost','retired');
CREATE TYPE public.equipment_condition AS ENUM ('new','good','fair','poor','unusable');
CREATE TYPE public.equipment_assignment_kind AS ENUM ('site','vehicle','person');
CREATE TYPE public.equipment_maintenance_result AS ENUM ('pass','advisory','fail');

CREATE TABLE public.equipment_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text,
  description text,
  manufacturer text,
  model text,
  requires_maintenance boolean NOT NULL DEFAULT false,
  maintenance_interval_days integer,
  default_site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX equipment_types_name_key ON public.equipment_types (lower(name));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipment_types TO authenticated;
GRANT ALL ON public.equipment_types TO service_role;
ALTER TABLE public.equipment_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal staff can view equipment types" ON public.equipment_types
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) a WHERE public.is_internal_staff(a.uid)));
CREATE POLICY "Equipment managers can insert equipment types" ON public.equipment_types
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) a WHERE public.has_role(a.uid,'admin') OR public.has_role(a.uid,'loader') OR public.has_role(a.uid,'fleet_manager')));
CREATE POLICY "Equipment managers can update equipment types" ON public.equipment_types
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) a WHERE public.has_role(a.uid,'admin') OR public.has_role(a.uid,'loader') OR public.has_role(a.uid,'fleet_manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) a WHERE public.has_role(a.uid,'admin') OR public.has_role(a.uid,'loader') OR public.has_role(a.uid,'fleet_manager')));
CREATE POLICY "Equipment managers can delete equipment types" ON public.equipment_types
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) a WHERE public.has_role(a.uid,'admin') OR public.has_role(a.uid,'loader') OR public.has_role(a.uid,'fleet_manager')));

CREATE TABLE public.equipment_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_type_id uuid NOT NULL REFERENCES public.equipment_types(id) ON DELETE CASCADE,
  serial text,
  asset_tag text,
  status public.equipment_unit_status NOT NULL DEFAULT 'available',
  condition public.equipment_condition NOT NULL DEFAULT 'good',
  assignment_kind public.equipment_assignment_kind,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  assigned_to_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  purchase_date date,
  purchase_cost numeric(10,2),
  last_maintenance_at timestamptz,
  next_maintenance_due date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX equipment_units_type_serial_key ON public.equipment_units (equipment_type_id, lower(serial)) WHERE serial IS NOT NULL;
CREATE INDEX equipment_units_type_idx ON public.equipment_units (equipment_type_id);
CREATE INDEX equipment_units_status_idx ON public.equipment_units (status);
CREATE INDEX equipment_units_due_idx ON public.equipment_units (next_maintenance_due);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipment_units TO authenticated;
GRANT ALL ON public.equipment_units TO service_role;
ALTER TABLE public.equipment_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal staff can view equipment units" ON public.equipment_units
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) a WHERE public.is_internal_staff(a.uid)));
CREATE POLICY "Equipment managers can insert equipment units" ON public.equipment_units
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) a WHERE public.has_role(a.uid,'admin') OR public.has_role(a.uid,'loader') OR public.has_role(a.uid,'fleet_manager')));
CREATE POLICY "Equipment managers can update equipment units" ON public.equipment_units
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) a WHERE public.has_role(a.uid,'admin') OR public.has_role(a.uid,'loader') OR public.has_role(a.uid,'fleet_manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) a WHERE public.has_role(a.uid,'admin') OR public.has_role(a.uid,'loader') OR public.has_role(a.uid,'fleet_manager')));
CREATE POLICY "Equipment managers can delete equipment units" ON public.equipment_units
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) a WHERE public.has_role(a.uid,'admin') OR public.has_role(a.uid,'loader') OR public.has_role(a.uid,'fleet_manager')));

CREATE TABLE public.equipment_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.equipment_units(id) ON DELETE CASCADE,
  from_assignment_kind public.equipment_assignment_kind,
  from_site_id uuid,
  from_vehicle_id uuid,
  from_user_id uuid,
  to_assignment_kind public.equipment_assignment_kind,
  to_site_id uuid,
  to_vehicle_id uuid,
  to_user_id uuid,
  moved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  moved_at timestamptz NOT NULL DEFAULT now(),
  notes text
);
CREATE INDEX equipment_movements_unit_idx ON public.equipment_movements (unit_id, moved_at DESC);

GRANT SELECT, INSERT ON public.equipment_movements TO authenticated;
GRANT ALL ON public.equipment_movements TO service_role;
ALTER TABLE public.equipment_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal staff can view equipment movements" ON public.equipment_movements
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) a WHERE public.is_internal_staff(a.uid)));
CREATE POLICY "Equipment managers can insert equipment movements" ON public.equipment_movements
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) a WHERE public.has_role(a.uid,'admin') OR public.has_role(a.uid,'loader') OR public.has_role(a.uid,'fleet_manager')));

CREATE TABLE public.equipment_maintenance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.equipment_units(id) ON DELETE CASCADE,
  performed_at timestamptz NOT NULL DEFAULT now(),
  performed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  result public.equipment_maintenance_result NOT NULL DEFAULT 'pass',
  notes text,
  next_due_at date,
  cost numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX equipment_maintenance_logs_unit_idx ON public.equipment_maintenance_logs (unit_id, performed_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipment_maintenance_logs TO authenticated;
GRANT ALL ON public.equipment_maintenance_logs TO service_role;
ALTER TABLE public.equipment_maintenance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal staff can view equipment maintenance logs" ON public.equipment_maintenance_logs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) a WHERE public.is_internal_staff(a.uid)));
CREATE POLICY "Equipment managers can insert equipment maintenance logs" ON public.equipment_maintenance_logs
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) a WHERE public.has_role(a.uid,'admin') OR public.has_role(a.uid,'loader') OR public.has_role(a.uid,'fleet_manager')));
CREATE POLICY "Equipment managers can update equipment maintenance logs" ON public.equipment_maintenance_logs
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) a WHERE public.has_role(a.uid,'admin') OR public.has_role(a.uid,'loader') OR public.has_role(a.uid,'fleet_manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) a WHERE public.has_role(a.uid,'admin') OR public.has_role(a.uid,'loader') OR public.has_role(a.uid,'fleet_manager')));
CREATE POLICY "Equipment managers can delete equipment maintenance logs" ON public.equipment_maintenance_logs
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) a WHERE public.has_role(a.uid,'admin') OR public.has_role(a.uid,'loader') OR public.has_role(a.uid,'fleet_manager')));

CREATE TRIGGER update_equipment_types_updated_at BEFORE UPDATE ON public.equipment_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_equipment_units_updated_at BEFORE UPDATE ON public.equipment_units
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.equipment_units_sync_maintenance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_interval integer;
  v_requires boolean;
BEGIN
  SELECT maintenance_interval_days, requires_maintenance
    INTO v_interval, v_requires
  FROM public.equipment_types
  WHERE id = NEW.equipment_type_id;

  IF COALESCE(v_requires, false) AND v_interval IS NOT NULL AND NEW.last_maintenance_at IS NOT NULL THEN
    IF TG_OP = 'INSERT'
       OR NEW.last_maintenance_at IS DISTINCT FROM OLD.last_maintenance_at
       OR NEW.next_maintenance_due IS NULL THEN
      NEW.next_maintenance_due := (NEW.last_maintenance_at::date + v_interval);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER equipment_units_sync_maintenance
  BEFORE INSERT OR UPDATE ON public.equipment_units
  FOR EACH ROW EXECUTE FUNCTION public.equipment_units_sync_maintenance();

CREATE OR REPLACE FUNCTION public.equipment_units_log_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assignment_kind IS DISTINCT FROM OLD.assignment_kind
     OR NEW.site_id IS DISTINCT FROM OLD.site_id
     OR NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id
     OR NEW.assigned_to_user_id IS DISTINCT FROM OLD.assigned_to_user_id THEN
    INSERT INTO public.equipment_movements (
      unit_id,
      from_assignment_kind, from_site_id, from_vehicle_id, from_user_id,
      to_assignment_kind, to_site_id, to_vehicle_id, to_user_id,
      moved_by
    ) VALUES (
      NEW.id,
      OLD.assignment_kind, OLD.site_id, OLD.vehicle_id, OLD.assigned_to_user_id,
      NEW.assignment_kind, NEW.site_id, NEW.vehicle_id, NEW.assigned_to_user_id,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER equipment_units_log_movement
  AFTER UPDATE ON public.equipment_units
  FOR EACH ROW EXECUTE FUNCTION public.equipment_units_log_movement();