-- 1. SKU on builds
ALTER TABLE public.bike_builds ADD COLUMN IF NOT EXISTS sku text;

-- 2. Customer self-service policies on builds
CREATE POLICY "bike_builds_owner_insert" ON public.bike_builds
FOR INSERT TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "bike_builds_owner_update" ON public.bike_builds
FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

-- Guard: non-staff cannot alter labour, stage or invoice fields
CREATE OR REPLACE FUNCTION public.bike_builds_guard_customer_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  is_staff boolean;
BEGIN
  IF uid IS NULL THEN
    RETURN NEW;
  END IF;
  is_staff := has_role(uid, 'admin'::user_role) OR has_role(uid, 'loader'::user_role) OR has_role(uid, 'mechanic'::user_role);
  IF is_staff THEN
    RETURN NEW;
  END IF;
  NEW.labour_cost := OLD.labour_cost;
  NEW.stage := OLD.stage;
  NEW.invoice_number := OLD.invoice_number;
  NEW.invoice_url := OLD.invoice_url;
  NEW.invoiced_at := OLD.invoiced_at;
  NEW.linked_stock_id := OLD.linked_stock_id;
  NEW.built_at := OLD.built_at;
  NEW.user_id := OLD.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bike_builds_guard_customer_updates ON public.bike_builds;
CREATE TRIGGER bike_builds_guard_customer_updates
BEFORE UPDATE ON public.bike_builds
FOR EACH ROW EXECUTE FUNCTION public.bike_builds_guard_customer_updates();

-- Customers may allocate/remove parts on their own builds while not invoiced
CREATE POLICY "bike_build_components_owner_insert" ON public.bike_build_components
FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.bike_builds b
  WHERE b.id = build_id AND b.user_id = (SELECT auth.uid()) AND b.stage <> 'invoiced'::bike_build_stage
));

CREATE POLICY "bike_build_components_owner_delete" ON public.bike_build_components
FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.bike_builds b
  WHERE b.id = bike_build_components.build_id AND b.user_id = (SELECT auth.uid()) AND b.stage <> 'invoiced'::bike_build_stage
));

-- 3. Stored builds (templates)
CREATE TABLE public.bike_build_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  sku text,
  bike_brand text,
  bike_model text,
  bike_type text,
  spec_notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bike_build_templates TO authenticated;
GRANT ALL ON public.bike_build_templates TO service_role;
ALTER TABLE public.bike_build_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bike_build_templates_staff_all" ON public.bike_build_templates
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid,'admin'::user_role) OR has_role(s.uid,'loader'::user_role) OR has_role(s.uid,'mechanic'::user_role)))
WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid,'admin'::user_role) OR has_role(s.uid,'loader'::user_role) OR has_role(s.uid,'mechanic'::user_role)));

CREATE POLICY "bike_build_templates_owner_all" ON public.bike_build_templates
FOR ALL TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE TABLE public.bike_build_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.bike_build_templates(id) ON DELETE CASCADE,
  category text NOT NULL,
  slot text,
  quantity integer NOT NULL DEFAULT 1,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX bike_build_template_items_template_id_idx ON public.bike_build_template_items(template_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bike_build_template_items TO authenticated;
GRANT ALL ON public.bike_build_template_items TO service_role;
ALTER TABLE public.bike_build_template_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bike_build_template_items_staff_all" ON public.bike_build_template_items
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid,'admin'::user_role) OR has_role(s.uid,'loader'::user_role) OR has_role(s.uid,'mechanic'::user_role)))
WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid,'admin'::user_role) OR has_role(s.uid,'loader'::user_role) OR has_role(s.uid,'mechanic'::user_role)));

CREATE POLICY "bike_build_template_items_owner_all" ON public.bike_build_template_items
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.bike_build_templates t WHERE t.id = bike_build_template_items.template_id AND t.user_id = (SELECT auth.uid())))
WITH CHECK (EXISTS (SELECT 1 FROM public.bike_build_templates t WHERE t.id = template_id AND t.user_id = (SELECT auth.uid())));

CREATE TRIGGER update_bike_build_templates_updated_at
BEFORE UPDATE ON public.bike_build_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bike_build_template_items_updated_at
BEFORE UPDATE ON public.bike_build_template_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();