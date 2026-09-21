
-- plans
ALTER TABLE public.route_plans
  ADD COLUMN IF NOT EXISTS generated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS selected_dates date[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS firm_days integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS inspection_lead_days integer,
  ADD COLUMN IF NOT EXISTS is_stale boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shortfall jsonb NOT NULL DEFAULT '{}'::jsonb;

-- routes
ALTER TABLE public.route_plan_routes
  ADD COLUMN IF NOT EXISTS is_provisional boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pass text NOT NULL DEFAULT 'A',
  ADD COLUMN IF NOT EXISTS day_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS affects_later_legs jsonb;

-- leg availability state
DO $$ BEGIN
  CREATE TYPE public.leg_availability_status AS ENUM ('active','expired','awaiting_new_dates');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.order_leg_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  leg_type text NOT NULL CHECK (leg_type IN ('collection','delivery')),
  availability_status public.leg_availability_status NOT NULL DEFAULT 'active',
  availability_expired_at timestamptz,
  redate_requested_at timestamptz,
  redate_reminders integer NOT NULL DEFAULT 0,
  priority_boost integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, leg_type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_leg_availability TO authenticated;
GRANT ALL ON public.order_leg_availability TO service_role;
ALTER TABLE public.order_leg_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read leg availability" ON public.order_leg_availability
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) a
    WHERE public.has_role(a.uid,'admin') OR public.has_role(a.uid,'sales') OR public.has_role(a.uid,'route_planner')));

CREATE POLICY "Staff manage leg availability" ON public.order_leg_availability
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) a
    WHERE public.has_role(a.uid,'admin') OR public.has_role(a.uid,'sales') OR public.has_role(a.uid,'route_planner')))
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) a
    WHERE public.has_role(a.uid,'admin') OR public.has_role(a.uid,'sales') OR public.has_role(a.uid,'route_planner')));

CREATE INDEX IF NOT EXISTS order_leg_availability_status_idx
  ON public.order_leg_availability (availability_status);

-- van unavailability grid memory
CREATE TABLE IF NOT EXISTS public.van_unavailability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  van_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  unavailable_on date NOT NULL,
  reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (van_id, unavailable_on)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.van_unavailability TO authenticated;
GRANT ALL ON public.van_unavailability TO service_role;
ALTER TABLE public.van_unavailability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read van unavailability" ON public.van_unavailability
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) a
    WHERE public.has_role(a.uid,'admin') OR public.has_role(a.uid,'sales') OR public.has_role(a.uid,'route_planner')));

CREATE POLICY "Staff manage van unavailability" ON public.van_unavailability
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) a
    WHERE public.has_role(a.uid,'admin') OR public.has_role(a.uid,'sales') OR public.has_role(a.uid,'route_planner')))
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) a
    WHERE public.has_role(a.uid,'admin') OR public.has_role(a.uid,'sales') OR public.has_role(a.uid,'route_planner')));

-- settings
ALTER TABLE public.workshop_settings
  ADD COLUMN IF NOT EXISTS working_days text[] NOT NULL DEFAULT ARRAY['sun','mon','tue','wed','thu'],
  ADD COLUMN IF NOT EXISTS redate_mode text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS default_horizon_days integer NOT NULL DEFAULT 5;

-- one reservation per leg across committed days
CREATE OR REPLACE FUNCTION public.guard_committed_leg()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $guard$
DECLARE clash int;
BEGIN
  SELECT count(*) INTO clash
  FROM public.route_plan_stops s
  JOIN public.route_plan_routes r ON r.id = s.route_id
  WHERE s.order_id = NEW.order_id
    AND s.leg_type = NEW.leg_type
    AND s.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND r.day_status IN ('locked','confirmed');
  IF clash > 0 AND EXISTS (
    SELECT 1 FROM public.route_plan_routes r2
    WHERE r2.id = NEW.route_id AND r2.day_status IN ('locked','confirmed')
  ) THEN
    RAISE EXCEPTION 'This job is already committed to another route';
  END IF;
  RETURN NEW;
END; $guard$;

DROP TRIGGER IF EXISTS route_plan_stops_committed_guard ON public.route_plan_stops;
CREATE TRIGGER route_plan_stops_committed_guard
  BEFORE INSERT OR UPDATE ON public.route_plan_stops
  FOR EACH ROW EXECUTE FUNCTION public.guard_committed_leg();

CREATE OR REPLACE FUNCTION public.touch_order_leg_availability()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS order_leg_availability_touch ON public.order_leg_availability;
CREATE TRIGGER order_leg_availability_touch BEFORE UPDATE ON public.order_leg_availability
  FOR EACH ROW EXECUTE FUNCTION public.touch_order_leg_availability();
