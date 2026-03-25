
CREATE TYPE public.warehouse_stock_status AS ENUM ('stored', 'reserved', 'dispatched', 'returned');

CREATE TABLE public.warehouse_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  deposited_by uuid,
  bike_brand text,
  bike_model text,
  bike_type text,
  bike_value numeric,
  item_notes text,
  bay text NOT NULL,
  position integer NOT NULL,
  status warehouse_stock_status NOT NULL DEFAULT 'stored',
  linked_order_id uuid,
  deposited_at timestamptz NOT NULL DEFAULT now(),
  dispatched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.warehouse_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "warehouse_stock_admin_select" ON public.warehouse_stock
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin'::user_role)));

CREATE POLICY "warehouse_stock_admin_insert" ON public.warehouse_stock
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin'::user_role)));

CREATE POLICY "warehouse_stock_admin_update" ON public.warehouse_stock
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin'::user_role)))
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin'::user_role)));

CREATE POLICY "warehouse_stock_admin_delete" ON public.warehouse_stock
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'admin'::user_role)));

CREATE POLICY "warehouse_stock_loader_select" ON public.warehouse_stock
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'loader'::user_role)));

CREATE POLICY "warehouse_stock_loader_update" ON public.warehouse_stock
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'loader'::user_role)))
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'loader'::user_role)));

CREATE POLICY "warehouse_stock_owner_select" ON public.warehouse_stock
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE TRIGGER update_warehouse_stock_updated_at
  BEFORE UPDATE ON public.warehouse_stock
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
