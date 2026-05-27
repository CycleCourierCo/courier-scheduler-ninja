
-- Routes table
CREATE TABLE public.dispatch_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  route_date DATE NOT NULL,
  driver_id UUID,
  status TEXT NOT NULL DEFAULT 'draft',
  total_distance_km NUMERIC,
  total_duration_min NUMERIC,
  optimised_at TIMESTAMPTZ,
  optimisation_meta JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dispatch_routes_date ON public.dispatch_routes(route_date);
CREATE INDEX idx_dispatch_routes_driver ON public.dispatch_routes(driver_id);

-- Stops table
CREATE TABLE public.dispatch_route_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.dispatch_routes(id) ON DELETE CASCADE,
  order_id UUID NOT NULL,
  stop_type TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  eta TIMESTAMPTZ,
  arrived_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  address TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dispatch_route_stops_route ON public.dispatch_route_stops(route_id);
CREATE INDEX idx_dispatch_route_stops_order ON public.dispatch_route_stops(order_id);

ALTER TABLE public.dispatch_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_route_stops ENABLE ROW LEVEL SECURITY;

-- Routes policies
CREATE POLICY dispatch_routes_admin_planner_all ON public.dispatch_routes
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role) OR has_role(s.uid, 'route_planner'::user_role)))
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role) OR has_role(s.uid, 'route_planner'::user_role)));

CREATE POLICY dispatch_routes_driver_select ON public.dispatch_routes
  FOR SELECT TO authenticated
  USING (driver_id = (SELECT auth.uid()));

-- Stops policies
CREATE POLICY dispatch_route_stops_admin_planner_all ON public.dispatch_route_stops
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role) OR has_role(s.uid, 'route_planner'::user_role)))
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role) OR has_role(s.uid, 'route_planner'::user_role)));

CREATE POLICY dispatch_route_stops_driver_select ON public.dispatch_route_stops
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.dispatch_routes r
    WHERE r.id = dispatch_route_stops.route_id AND r.driver_id = (SELECT auth.uid())));

CREATE POLICY dispatch_route_stops_driver_update ON public.dispatch_route_stops
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.dispatch_routes r
    WHERE r.id = dispatch_route_stops.route_id AND r.driver_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.dispatch_routes r
    WHERE r.id = dispatch_route_stops.route_id AND r.driver_id = (SELECT auth.uid())));

-- Timestamp triggers
CREATE TRIGGER update_dispatch_routes_updated_at
  BEFORE UPDATE ON public.dispatch_routes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_dispatch_route_stops_updated_at
  BEFORE UPDATE ON public.dispatch_route_stops
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
