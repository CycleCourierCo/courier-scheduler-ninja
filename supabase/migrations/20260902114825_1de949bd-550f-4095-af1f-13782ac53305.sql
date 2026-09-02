-- 1. Component support on warehouse stock
DO $$ BEGIN
  CREATE TYPE public.warehouse_item_kind AS ENUM ('bike', 'component');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.warehouse_stock
  ADD COLUMN IF NOT EXISTS item_kind public.warehouse_item_kind NOT NULL DEFAULT 'bike',
  ADD COLUMN IF NOT EXISTS component_category text,
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS spec text;

CREATE INDEX IF NOT EXISTS warehouse_stock_item_kind_idx ON public.warehouse_stock (item_kind);

-- 2. Build stages
DO $$ BEGIN
  CREATE TYPE public.bike_build_stage AS ENUM (
    'awaiting_build',
    'awaiting_parts',
    'picking_parts',
    'in_workshop',
    'bike_built',
    'invoiced'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Builds
CREATE TABLE IF NOT EXISTS public.bike_builds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  name text NOT NULL,
  bike_brand text,
  bike_model text,
  bike_type text,
  spec_notes text,
  stage public.bike_build_stage NOT NULL DEFAULT 'awaiting_build',
  labour_cost numeric NOT NULL DEFAULT 0,
  parts_total numeric NOT NULL DEFAULT 0,
  invoice_number text,
  invoice_url text,
  invoiced_at timestamptz,
  built_at timestamptz,
  linked_stock_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bike_builds TO authenticated;
GRANT ALL ON public.bike_builds TO service_role;
ALTER TABLE public.bike_builds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bike_builds_staff_all" ON public.bike_builds
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role) OR has_role(s.uid, 'loader'::user_role) OR has_role(s.uid, 'mechanic'::user_role)))
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role) OR has_role(s.uid, 'loader'::user_role) OR has_role(s.uid, 'mechanic'::user_role)));

CREATE POLICY "bike_builds_owner_select" ON public.bike_builds
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- 4. Build components
CREATE TABLE IF NOT EXISTS public.bike_build_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id uuid NOT NULL REFERENCES public.bike_builds(id) ON DELETE CASCADE,
  stock_id uuid REFERENCES public.warehouse_stock(id) ON DELETE SET NULL,
  slot text,
  category text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_value numeric,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bike_build_components_build_idx ON public.bike_build_components (build_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bike_build_components TO authenticated;
GRANT ALL ON public.bike_build_components TO service_role;
ALTER TABLE public.bike_build_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bike_build_components_staff_all" ON public.bike_build_components
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role) OR has_role(s.uid, 'loader'::user_role) OR has_role(s.uid, 'mechanic'::user_role)))
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role) OR has_role(s.uid, 'loader'::user_role) OR has_role(s.uid, 'mechanic'::user_role)));

CREATE POLICY "bike_build_components_owner_select" ON public.bike_build_components
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bike_builds b WHERE b.id = build_id AND b.user_id = (SELECT auth.uid())));

-- 5. Stage log
CREATE TABLE IF NOT EXISTS public.bike_build_stage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id uuid NOT NULL REFERENCES public.bike_builds(id) ON DELETE CASCADE,
  from_stage public.bike_build_stage,
  to_stage public.bike_build_stage NOT NULL,
  changed_by uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bike_build_stage_log_build_idx ON public.bike_build_stage_log (build_id);

GRANT SELECT, INSERT ON public.bike_build_stage_log TO authenticated;
GRANT ALL ON public.bike_build_stage_log TO service_role;
ALTER TABLE public.bike_build_stage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bike_build_stage_log_staff_select" ON public.bike_build_stage_log
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role) OR has_role(s.uid, 'loader'::user_role) OR has_role(s.uid, 'mechanic'::user_role)));

CREATE POLICY "bike_build_stage_log_staff_insert" ON public.bike_build_stage_log
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role) OR has_role(s.uid, 'loader'::user_role) OR has_role(s.uid, 'mechanic'::user_role)));

CREATE POLICY "bike_build_stage_log_owner_select" ON public.bike_build_stage_log
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bike_builds b WHERE b.id = build_id AND b.user_id = (SELECT auth.uid())));

-- 6. Timestamp + stage logging triggers
CREATE OR REPLACE FUNCTION public.bike_builds_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bike_builds_set_updated_at ON public.bike_builds;
CREATE TRIGGER bike_builds_set_updated_at
BEFORE UPDATE ON public.bike_builds
FOR EACH ROW EXECUTE FUNCTION public.bike_builds_touch_updated_at();

DROP TRIGGER IF EXISTS bike_build_components_set_updated_at ON public.bike_build_components;
CREATE TRIGGER bike_build_components_set_updated_at
BEFORE UPDATE ON public.bike_build_components
FOR EACH ROW EXECUTE FUNCTION public.bike_builds_touch_updated_at();

CREATE OR REPLACE FUNCTION public.log_bike_build_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    INSERT INTO public.bike_build_stage_log (build_id, from_stage, to_stage, changed_by)
    VALUES (NEW.id, OLD.stage, NEW.stage, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bike_builds_log_stage ON public.bike_builds;
CREATE TRIGGER bike_builds_log_stage
AFTER UPDATE ON public.bike_builds
FOR EACH ROW EXECUTE FUNCTION public.log_bike_build_stage_change();