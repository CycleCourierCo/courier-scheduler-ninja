-- Vehicle status enum
DO $$ BEGIN
  CREATE TYPE public.vehicle_status AS ENUM ('purchased', 'in_prep', 'in_use', 'sold', 'off_road');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Vehicles table
CREATE TABLE IF NOT EXISTS public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration text NOT NULL UNIQUE,
  status public.vehicle_status NOT NULL DEFAULT 'purchased',
  london_auto_pay boolean NOT NULL DEFAULT false,
  dartford_crossing boolean NOT NULL DEFAULT false,
  make text,
  colour text,
  fuel_type text,
  year_of_manufacture integer,
  engine_capacity integer,
  co2_emissions integer,
  tax_status text,
  tax_due_date date,
  mot_status text,
  mot_expiry_date date,
  date_of_last_v5c_issued date,
  marked_for_export boolean,
  type_approval text,
  wheelplan text,
  revenue_weight integer,
  euro_status text,
  real_driving_emissions text,
  notes text,
  ves_raw jsonb,
  last_refreshed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY vehicles_select_policy ON public.vehicles
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.has_role(s.uid, 'admin'::user_role)));

CREATE POLICY vehicles_insert_policy ON public.vehicles
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.has_role(s.uid, 'admin'::user_role)));

CREATE POLICY vehicles_update_policy ON public.vehicles
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.has_role(s.uid, 'admin'::user_role)))
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.has_role(s.uid, 'admin'::user_role)));

CREATE POLICY vehicles_delete_policy ON public.vehicles
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.has_role(s.uid, 'admin'::user_role)));

CREATE TRIGGER vehicles_update_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
