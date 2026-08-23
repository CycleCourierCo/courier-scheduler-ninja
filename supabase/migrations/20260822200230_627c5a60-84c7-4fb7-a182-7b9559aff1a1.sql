-- 1. Sites
CREATE TABLE public.sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  address text,
  postcode text,
  lat double precision,
  lon double precision,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sites TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sites TO authenticated;
GRANT ALL ON public.sites TO service_role;

ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sites_select_all" ON public.sites FOR SELECT USING (true);
CREATE POLICY "sites_admin_insert" ON public.sites FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u WHERE public.has_role(u.uid, 'admin')));
CREATE POLICY "sites_admin_update" ON public.sites FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u WHERE public.has_role(u.uid, 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u WHERE public.has_role(u.uid, 'admin')));
CREATE POLICY "sites_admin_delete" ON public.sites FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u WHERE public.has_role(u.uid, 'admin')));

CREATE TRIGGER sites_updated_at BEFORE UPDATE ON public.sites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.sites (name, code, address, postcode, lat, lon, is_default, display_order)
VALUES
  ('Birmingham Depot', 'BHM', 'Lawden Road, Birmingham', 'B10 0AD', 52.4690197, -1.8757663, true, 1),
  ('Scotland Depot', 'SCO', NULL, NULL, NULL, NULL, false, 2);

-- 2. Site awareness on bays and stock
ALTER TABLE public.storage_bays
  ADD COLUMN site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL;
ALTER TABLE public.warehouse_stock
  ADD COLUMN site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL;

UPDATE public.storage_bays SET site_id = (SELECT id FROM public.sites WHERE code = 'BHM') WHERE site_id IS NULL;
UPDATE public.warehouse_stock SET site_id = (SELECT id FROM public.sites WHERE code = 'BHM') WHERE site_id IS NULL;

ALTER TABLE public.storage_bays DROP CONSTRAINT IF EXISTS storage_bays_label_key;
CREATE UNIQUE INDEX IF NOT EXISTS storage_bays_site_label_key ON public.storage_bays (site_id, upper(label));
CREATE INDEX IF NOT EXISTS warehouse_stock_site_idx ON public.warehouse_stock (site_id);

-- 3. Scotland flags on orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_scotland boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scotland_direction text,
  ADD COLUMN IF NOT EXISTS scotland_override boolean,
  ADD COLUMN IF NOT EXISTS current_site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS orders_is_scotland_idx ON public.orders (is_scotland) WHERE is_scotland;

-- 4. New Scotland milestones
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'awaiting_trunk_to_scotland';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'in_transit_to_scotland';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'at_scotland_depot';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'awaiting_trunk_to_depot';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'in_transit_to_depot';

-- 5. Trunk runs
CREATE TABLE public.trunk_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date date NOT NULL,
  direction text NOT NULL DEFAULT 'northbound',
  origin_site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  destination_site_id uuid REFERENCES public.sites(id) ON DELETE SET NULL,
  driver_id uuid,
  vehicle_id uuid,
  driver_mode text NOT NULL DEFAULT 'depot_trunker',
  capacity_spaces numeric NOT NULL DEFAULT 10,
  status text NOT NULL DEFAULT 'planned',
  notes text,
  departed_at timestamptz,
  arrived_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trunk_runs TO authenticated;
GRANT ALL ON public.trunk_runs TO service_role;
ALTER TABLE public.trunk_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trunk_runs_staff_select" ON public.trunk_runs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u WHERE public.is_internal_staff(u.uid)));
CREATE POLICY "trunk_runs_staff_insert" ON public.trunk_runs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u WHERE public.is_internal_staff(u.uid)));
CREATE POLICY "trunk_runs_staff_update" ON public.trunk_runs FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u WHERE public.is_internal_staff(u.uid)))
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u WHERE public.is_internal_staff(u.uid)));
CREATE POLICY "trunk_runs_admin_delete" ON public.trunk_runs FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u WHERE public.has_role(u.uid, 'admin')));

CREATE TRIGGER trunk_runs_updated_at BEFORE UPDATE ON public.trunk_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX trunk_runs_date_idx ON public.trunk_runs (run_date DESC);

-- 6. Trunk run items
CREATE TABLE public.trunk_run_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.trunk_runs(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  stock_id uuid REFERENCES public.warehouse_stock(id) ON DELETE SET NULL,
  spaces numeric NOT NULL DEFAULT 1,
  origin_bay text,
  origin_position integer,
  destination_bay text,
  destination_position integer,
  status text NOT NULL DEFAULT 'planned',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trunk_run_items TO authenticated;
GRANT ALL ON public.trunk_run_items TO service_role;
ALTER TABLE public.trunk_run_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trunk_run_items_staff_select" ON public.trunk_run_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u WHERE public.is_internal_staff(u.uid)));
CREATE POLICY "trunk_run_items_staff_insert" ON public.trunk_run_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u WHERE public.is_internal_staff(u.uid)));
CREATE POLICY "trunk_run_items_staff_update" ON public.trunk_run_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u WHERE public.is_internal_staff(u.uid)))
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u WHERE public.is_internal_staff(u.uid)));
CREATE POLICY "trunk_run_items_staff_delete" ON public.trunk_run_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u WHERE public.is_internal_staff(u.uid)));

CREATE TRIGGER trunk_run_items_updated_at BEFORE UPDATE ON public.trunk_run_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX trunk_run_items_run_idx ON public.trunk_run_items (run_id);
CREATE UNIQUE INDEX trunk_run_items_run_order_key ON public.trunk_run_items (run_id, order_id) WHERE order_id IS NOT NULL;