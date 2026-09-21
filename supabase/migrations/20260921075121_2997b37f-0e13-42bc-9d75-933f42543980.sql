CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE public.difficult_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  geom geometry(Polygon, 4326) NOT NULL,
  max_route_hours numeric NOT NULL DEFAULT 15,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX difficult_areas_geom_idx ON public.difficult_areas USING gist (geom);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.difficult_areas TO authenticated;
GRANT ALL ON public.difficult_areas TO service_role;
ALTER TABLE public.difficult_areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internal staff can view difficult areas" ON public.difficult_areas
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u WHERE public.is_internal_staff(u.uid)));
CREATE POLICY "Admins can manage difficult areas" ON public.difficult_areas
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u WHERE public.has_role(u.uid, 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u WHERE public.has_role(u.uid, 'admin')));

CREATE TABLE public.route_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  horizon_start date NOT NULL,
  horizon_end date NOT NULL,
  shift_start time NOT NULL DEFAULT '09:00',
  status text NOT NULL DEFAULT 'draft',
  assume_next_day_inspection boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.route_plan_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.route_plans ON DELETE CASCADE,
  route_date date NOT NULL,
  variant text NOT NULL DEFAULT 'primary',
  van_id uuid,
  van_name text,
  is_expedition boolean NOT NULL DEFAULT false,
  total_miles numeric,
  total_duration_s integer,
  stop_count integer,
  max_load numeric,
  van_capacity numeric,
  geometry text,
  tradeoff_note text,
  selected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX route_plan_routes_plan_idx ON public.route_plan_routes (plan_id, route_date, variant);

CREATE TABLE public.route_plan_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.route_plan_routes ON DELETE CASCADE,
  seq integer NOT NULL,
  leg_type text NOT NULL,
  order_id uuid NOT NULL,
  eta timestamptz,
  service_s integer NOT NULL DEFAULT 900,
  lat numeric,
  lon numeric,
  is_difficult_area boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX route_plan_stops_route_idx ON public.route_plan_stops (route_id, seq);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_plans TO authenticated;
GRANT ALL ON public.route_plans TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_plan_routes TO authenticated;
GRANT ALL ON public.route_plan_routes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_plan_stops TO authenticated;
GRANT ALL ON public.route_plan_stops TO service_role;

ALTER TABLE public.route_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_plan_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_plan_stops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal staff can manage route plans" ON public.route_plans
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u WHERE public.is_internal_staff(u.uid)))
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u WHERE public.is_internal_staff(u.uid)));

CREATE POLICY "Internal staff can manage route plan routes" ON public.route_plan_routes
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u WHERE public.is_internal_staff(u.uid)))
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u WHERE public.is_internal_staff(u.uid)));

CREATE POLICY "Internal staff can manage route plan stops" ON public.route_plan_stops
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u WHERE public.is_internal_staff(u.uid)))
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u WHERE public.is_internal_staff(u.uid)));

CREATE TRIGGER difficult_areas_updated_at BEFORE UPDATE ON public.difficult_areas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER route_plans_updated_at BEFORE UPDATE ON public.route_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();