-- Invoker helpers scoped to the signed-in user (no user argument, so they reveal nothing about others).
CREATE OR REPLACE FUNCTION public.kb_viewer_is_driver_only()
RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'driver')
     AND NOT EXISTS (
       SELECT 1 FROM public.user_roles
       WHERE user_id = auth.uid()
         AND role IN ('admin','cs_agent','route_planner','loader','sales','timeslip_admin','mechanic','project_manager')
     )
$$;

CREATE OR REPLACE FUNCTION public.kb_viewer_can_edit()
RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT public.is_internal_staff(auth.uid()) AND NOT public.kb_viewer_is_driver_only()
$$;

REVOKE EXECUTE ON FUNCTION public.kb_viewer_is_driver_only() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.kb_viewer_can_edit() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kb_viewer_is_driver_only() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kb_viewer_can_edit() TO authenticated, service_role;

-- Categories
DROP POLICY IF EXISTS kb_categories_select_staff ON public.kb_categories;
DROP POLICY IF EXISTS kb_categories_insert_staff ON public.kb_categories;
DROP POLICY IF EXISTS kb_categories_update_staff ON public.kb_categories;
CREATE POLICY kb_categories_select_staff ON public.kb_categories FOR SELECT TO authenticated
  USING (public.is_internal_staff((SELECT auth.uid()))
         AND (slug = 'drivers' OR NOT public.kb_viewer_is_driver_only()));
CREATE POLICY kb_categories_insert_staff ON public.kb_categories FOR INSERT TO authenticated
  WITH CHECK (public.kb_viewer_can_edit());
CREATE POLICY kb_categories_update_staff ON public.kb_categories FOR UPDATE TO authenticated
  USING (public.kb_viewer_can_edit()) WITH CHECK (public.kb_viewer_can_edit());

-- Articles: drivers read only Published SOPs in the Drivers section
DROP POLICY IF EXISTS kb_articles_select_staff ON public.kb_articles;
DROP POLICY IF EXISTS kb_articles_insert_staff ON public.kb_articles;
DROP POLICY IF EXISTS kb_articles_update_staff ON public.kb_articles;
CREATE POLICY kb_articles_select_staff ON public.kb_articles FOR SELECT TO authenticated
  USING (public.is_internal_staff((SELECT auth.uid()))
         AND (NOT public.kb_viewer_is_driver_only()
              OR (status = 'published'
                  AND EXISTS (SELECT 1 FROM public.kb_categories c
                              WHERE c.id = kb_articles.category_id AND c.slug = 'drivers'))));
CREATE POLICY kb_articles_insert_staff ON public.kb_articles FOR INSERT TO authenticated
  WITH CHECK (public.kb_viewer_can_edit());
CREATE POLICY kb_articles_update_staff ON public.kb_articles FOR UPDATE TO authenticated
  USING (public.kb_viewer_can_edit()) WITH CHECK (public.kb_viewer_can_edit());

DROP POLICY IF EXISTS kb_article_versions_select_staff ON public.kb_article_versions;
CREATE POLICY kb_article_versions_select_staff ON public.kb_article_versions FOR SELECT TO authenticated
  USING (public.kb_viewer_can_edit());

-- Checklist items follow article visibility
DROP POLICY IF EXISTS kb_checklist_items_select_staff ON public.kb_checklist_items;
DROP POLICY IF EXISTS kb_checklist_items_insert_staff ON public.kb_checklist_items;
DROP POLICY IF EXISTS kb_checklist_items_update_staff ON public.kb_checklist_items;
DROP POLICY IF EXISTS kb_checklist_items_delete_staff ON public.kb_checklist_items;
CREATE POLICY kb_checklist_items_select_staff ON public.kb_checklist_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.kb_articles a WHERE a.id = kb_checklist_items.article_id));
CREATE POLICY kb_checklist_items_insert_staff ON public.kb_checklist_items FOR INSERT TO authenticated
  WITH CHECK (public.kb_viewer_can_edit());
CREATE POLICY kb_checklist_items_update_staff ON public.kb_checklist_items FOR UPDATE TO authenticated
  USING (public.kb_viewer_can_edit()) WITH CHECK (public.kb_viewer_can_edit());
CREATE POLICY kb_checklist_items_delete_staff ON public.kb_checklist_items FOR DELETE TO authenticated
  USING (public.kb_viewer_can_edit());

-- Checklist runs
DROP POLICY IF EXISTS kb_runs_select_staff ON public.kb_checklist_runs;
DROP POLICY IF EXISTS kb_runs_insert_own ON public.kb_checklist_runs;
CREATE POLICY kb_runs_select_staff ON public.kb_checklist_runs FOR SELECT TO authenticated
  USING (public.is_internal_staff((SELECT auth.uid()))
         AND (user_id = (SELECT auth.uid()) OR NOT public.kb_viewer_is_driver_only()));
CREATE POLICY kb_runs_insert_own ON public.kb_checklist_runs FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_staff((SELECT auth.uid()))
              AND user_id = (SELECT auth.uid())
              AND EXISTS (SELECT 1 FROM public.kb_articles a WHERE a.id = kb_checklist_runs.article_id));

DROP POLICY IF EXISTS kb_run_items_select_staff ON public.kb_checklist_run_items;
CREATE POLICY kb_run_items_select_staff ON public.kb_checklist_run_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.kb_checklist_runs r WHERE r.id = kb_checklist_run_items.run_id));

DROP FUNCTION IF EXISTS public.kb_can_read_article(uuid, uuid);
DROP FUNCTION IF EXISTS public.kb_can_read_category(uuid, uuid);
DROP FUNCTION IF EXISTS public.kb_can_edit(uuid);
DROP FUNCTION IF EXISTS public.kb_is_driver_only(uuid);