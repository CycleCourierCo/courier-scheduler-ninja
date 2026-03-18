
-- Phase 1: Historical Route Ingestion + Archetypes tables

-- 1. historical_routes — one row per driver-day route
CREATE TABLE public.historical_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_date date NOT NULL,
  driver_name text NOT NULL,
  route_type text NOT NULL DEFAULT 'collection', -- 'collection' or 'delivery'
  stop_count integer NOT NULL DEFAULT 0,
  regions text[] NOT NULL DEFAULT '{}',
  centroid_lat double precision,
  centroid_lon double precision,
  spread_km numeric,
  corridor_bearing numeric,
  postcode_prefixes text[] DEFAULT '{}',
  total_distance_km numeric,
  stops jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(route_date, driver_name, route_type)
);

ALTER TABLE public.historical_routes ENABLE ROW LEVEL SECURITY;

-- 2. historical_route_stops — denormalized for querying
CREATE TABLE public.historical_route_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  historical_route_id uuid NOT NULL REFERENCES public.historical_routes(id) ON DELETE CASCADE,
  order_id uuid NOT NULL,
  type text NOT NULL,
  lat double precision,
  lon double precision,
  postcode_prefix text,
  region text,
  sequence_order integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.historical_route_stops ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_historical_route_stops_route_id ON public.historical_route_stops(historical_route_id);
CREATE INDEX idx_historical_route_stops_order_id ON public.historical_route_stops(order_id);

-- 3. route_archetypes — clustered route patterns
CREATE TABLE public.route_archetypes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  regions text[] NOT NULL DEFAULT '{}',
  centroid_lat double precision,
  centroid_lon double precision,
  avg_spread_km numeric,
  avg_stop_count numeric,
  corridor_bearing numeric,
  postcode_prefixes text[] DEFAULT '{}',
  member_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.route_archetypes ENABLE ROW LEVEL SECURITY;

-- 4. route_archetype_members — links routes to archetypes
CREATE TABLE public.route_archetype_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  archetype_id uuid NOT NULL REFERENCES public.route_archetypes(id) ON DELETE CASCADE,
  historical_route_id uuid NOT NULL REFERENCES public.historical_routes(id) ON DELETE CASCADE,
  similarity_score numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.route_archetype_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_route_archetype_members_archetype ON public.route_archetype_members(archetype_id);
CREATE INDEX idx_route_archetype_members_route ON public.route_archetype_members(historical_route_id);

-- Indexes on historical_routes
CREATE INDEX idx_historical_routes_date ON public.historical_routes(route_date);
CREATE INDEX idx_historical_routes_driver ON public.historical_routes(driver_name);

-- RLS Policies (admin + route_planner SELECT, admin-only write)

-- historical_routes policies
CREATE POLICY "historical_routes_select_policy" ON public.historical_routes
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role) OR has_role(s.uid, 'route_planner'::user_role)
  ));

CREATE POLICY "historical_routes_insert_policy" ON public.historical_routes
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role)
  ));

CREATE POLICY "historical_routes_update_policy" ON public.historical_routes
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role)
  ));

CREATE POLICY "historical_routes_delete_policy" ON public.historical_routes
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role)
  ));

-- historical_route_stops policies
CREATE POLICY "historical_route_stops_select_policy" ON public.historical_route_stops
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role) OR has_role(s.uid, 'route_planner'::user_role)
  ));

CREATE POLICY "historical_route_stops_insert_policy" ON public.historical_route_stops
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role)
  ));

CREATE POLICY "historical_route_stops_update_policy" ON public.historical_route_stops
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role)
  ));

CREATE POLICY "historical_route_stops_delete_policy" ON public.historical_route_stops
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role)
  ));

-- route_archetypes policies
CREATE POLICY "route_archetypes_select_policy" ON public.route_archetypes
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role) OR has_role(s.uid, 'route_planner'::user_role)
  ));

CREATE POLICY "route_archetypes_insert_policy" ON public.route_archetypes
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role)
  ));

CREATE POLICY "route_archetypes_update_policy" ON public.route_archetypes
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role)
  ));

CREATE POLICY "route_archetypes_delete_policy" ON public.route_archetypes
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role)
  ));

-- route_archetype_members policies
CREATE POLICY "route_archetype_members_select_policy" ON public.route_archetype_members
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role) OR has_role(s.uid, 'route_planner'::user_role)
  ));

CREATE POLICY "route_archetype_members_insert_policy" ON public.route_archetype_members
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role)
  ));

CREATE POLICY "route_archetype_members_update_policy" ON public.route_archetype_members
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role)
  ));

CREATE POLICY "route_archetype_members_delete_policy" ON public.route_archetype_members
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role)
  ));
