-- Broaden the "staff" definition on bike build tables to include customer service agents.
CREATE OR REPLACE FUNCTION public.is_build_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role(_user_id, 'admin'::user_role)
      OR has_role(_user_id, 'loader'::user_role)
      OR has_role(_user_id, 'mechanic'::user_role)
      OR has_role(_user_id, 'cs_agent'::user_role);
$$;

REVOKE EXECUTE ON FUNCTION public.is_build_staff(uuid) FROM anon;

DROP POLICY IF EXISTS bike_builds_staff_all ON public.bike_builds;
CREATE POLICY bike_builds_staff_all ON public.bike_builds FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.is_build_staff(s.uid)))
WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.is_build_staff(s.uid)));

DROP POLICY IF EXISTS bike_build_components_staff_all ON public.bike_build_components;
CREATE POLICY bike_build_components_staff_all ON public.bike_build_components FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.is_build_staff(s.uid)))
WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.is_build_staff(s.uid)));

DROP POLICY IF EXISTS bike_build_stage_log_staff_select ON public.bike_build_stage_log;
CREATE POLICY bike_build_stage_log_staff_select ON public.bike_build_stage_log FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.is_build_staff(s.uid)));

DROP POLICY IF EXISTS bike_build_stage_log_staff_insert ON public.bike_build_stage_log;
CREATE POLICY bike_build_stage_log_staff_insert ON public.bike_build_stage_log FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.is_build_staff(s.uid)));

DROP POLICY IF EXISTS bike_build_templates_staff_all ON public.bike_build_templates;
CREATE POLICY bike_build_templates_staff_all ON public.bike_build_templates FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.is_build_staff(s.uid)))
WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.is_build_staff(s.uid)));

DROP POLICY IF EXISTS bike_build_template_items_staff_all ON public.bike_build_template_items;
CREATE POLICY bike_build_template_items_staff_all ON public.bike_build_template_items FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.is_build_staff(s.uid)))
WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.is_build_staff(s.uid)));

-- Stage guard: treat cs_agent as staff too.
CREATE OR REPLACE FUNCTION public.bike_builds_guard_customer_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR public.is_build_staff(uid) THEN
    RETURN NEW;
  END IF;
  NEW.labour_cost := OLD.labour_cost;
  NEW.invoice_number := OLD.invoice_number;
  NEW.invoice_url := OLD.invoice_url;
  NEW.invoiced_at := OLD.invoiced_at;
  NEW.linked_stock_id := OLD.linked_stock_id;
  NEW.built_at := OLD.built_at;
  NEW.user_id := OLD.user_id;
  IF NOT (
    OLD.stage IN ('awaiting_build','awaiting_parts','picking_parts')
    AND NEW.stage IN ('awaiting_build','awaiting_parts','picking_parts')
  ) THEN
    NEW.stage := OLD.stage;
  END IF;
  RETURN NEW;
END;
$$;

-- Customer service needs to see and allocate warehouse stock for builds.
CREATE POLICY warehouse_stock_cs_select ON public.warehouse_stock FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'cs_agent'::user_role)));

CREATE POLICY warehouse_stock_cs_update ON public.warehouse_stock FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'cs_agent'::user_role)))
WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'cs_agent'::user_role)));

CREATE POLICY warehouse_stock_cs_insert ON public.warehouse_stock FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid, 'cs_agent'::user_role)));