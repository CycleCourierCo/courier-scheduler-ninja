-- Driver-only staff: hold the driver role and no other office/workshop staff role.
CREATE OR REPLACE FUNCTION public.kb_is_driver_only(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role = 'driver')
     AND NOT EXISTS (
       SELECT 1 FROM public.user_roles
       WHERE user_id = _uid
         AND role IN ('admin','cs_agent','route_planner','loader','sales','timeslip_admin','mechanic','project_manager')
     )
$$;

CREATE OR REPLACE FUNCTION public.kb_can_edit(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_internal_staff(_uid) AND NOT public.kb_is_driver_only(_uid)
$$;

CREATE OR REPLACE FUNCTION public.kb_can_read_category(_uid uuid, _category_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_internal_staff(_uid)
     AND (
       NOT public.kb_is_driver_only(_uid)
       OR EXISTS (SELECT 1 FROM public.kb_categories c WHERE c.id = _category_id AND c.slug = 'drivers')
     )
$$;

CREATE OR REPLACE FUNCTION public.kb_can_read_article(_uid uuid, _article_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.kb_articles a
    WHERE a.id = _article_id AND public.kb_can_read_category(_uid, a.category_id)
  )
$$;

REVOKE EXECUTE ON FUNCTION public.kb_is_driver_only(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.kb_can_edit(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.kb_can_read_category(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.kb_can_read_article(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kb_is_driver_only(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kb_can_edit(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kb_can_read_category(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kb_can_read_article(uuid, uuid) TO authenticated, service_role;

-- Categories
DROP POLICY IF EXISTS kb_categories_select_staff ON public.kb_categories;
DROP POLICY IF EXISTS kb_categories_insert_staff ON public.kb_categories;
DROP POLICY IF EXISTS kb_categories_update_staff ON public.kb_categories;
CREATE POLICY kb_categories_select_staff ON public.kb_categories FOR SELECT TO authenticated
  USING (public.is_internal_staff((SELECT auth.uid()))
         AND (slug = 'drivers' OR NOT public.kb_is_driver_only((SELECT auth.uid()))));
CREATE POLICY kb_categories_insert_staff ON public.kb_categories FOR INSERT TO authenticated
  WITH CHECK (public.kb_can_edit((SELECT auth.uid())));
CREATE POLICY kb_categories_update_staff ON public.kb_categories FOR UPDATE TO authenticated
  USING (public.kb_can_edit((SELECT auth.uid())))
  WITH CHECK (public.kb_can_edit((SELECT auth.uid())));

-- Articles
DROP POLICY IF EXISTS kb_articles_select_staff ON public.kb_articles;
DROP POLICY IF EXISTS kb_articles_insert_staff ON public.kb_articles;
DROP POLICY IF EXISTS kb_articles_update_staff ON public.kb_articles;
CREATE POLICY kb_articles_select_staff ON public.kb_articles FOR SELECT TO authenticated
  USING (public.kb_can_read_category((SELECT auth.uid()), category_id));
CREATE POLICY kb_articles_insert_staff ON public.kb_articles FOR INSERT TO authenticated
  WITH CHECK (public.kb_can_edit((SELECT auth.uid())));
CREATE POLICY kb_articles_update_staff ON public.kb_articles FOR UPDATE TO authenticated
  USING (public.kb_can_edit((SELECT auth.uid())))
  WITH CHECK (public.kb_can_edit((SELECT auth.uid())));

-- Version history: editors only
DROP POLICY IF EXISTS kb_article_versions_select_staff ON public.kb_article_versions;
CREATE POLICY kb_article_versions_select_staff ON public.kb_article_versions FOR SELECT TO authenticated
  USING (public.kb_can_edit((SELECT auth.uid())));

-- Checklist items
DROP POLICY IF EXISTS kb_checklist_items_select_staff ON public.kb_checklist_items;
DROP POLICY IF EXISTS kb_checklist_items_insert_staff ON public.kb_checklist_items;
DROP POLICY IF EXISTS kb_checklist_items_update_staff ON public.kb_checklist_items;
DROP POLICY IF EXISTS kb_checklist_items_delete_staff ON public.kb_checklist_items;
CREATE POLICY kb_checklist_items_select_staff ON public.kb_checklist_items FOR SELECT TO authenticated
  USING (public.kb_can_read_article((SELECT auth.uid()), article_id));
CREATE POLICY kb_checklist_items_insert_staff ON public.kb_checklist_items FOR INSERT TO authenticated
  WITH CHECK (public.kb_can_edit((SELECT auth.uid())));
CREATE POLICY kb_checklist_items_update_staff ON public.kb_checklist_items FOR UPDATE TO authenticated
  USING (public.kb_can_edit((SELECT auth.uid())))
  WITH CHECK (public.kb_can_edit((SELECT auth.uid())));
CREATE POLICY kb_checklist_items_delete_staff ON public.kb_checklist_items FOR DELETE TO authenticated
  USING (public.kb_can_edit((SELECT auth.uid())));

-- Checklist runs: drivers only see their own runs, on SOPs they can read
DROP POLICY IF EXISTS kb_runs_select_staff ON public.kb_checklist_runs;
DROP POLICY IF EXISTS kb_runs_insert_own ON public.kb_checklist_runs;
CREATE POLICY kb_runs_select_staff ON public.kb_checklist_runs FOR SELECT TO authenticated
  USING (public.is_internal_staff((SELECT auth.uid()))
         AND (user_id = (SELECT auth.uid()) OR NOT public.kb_is_driver_only((SELECT auth.uid()))));
CREATE POLICY kb_runs_insert_own ON public.kb_checklist_runs FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_staff((SELECT auth.uid()))
              AND user_id = (SELECT auth.uid())
              AND public.kb_can_read_article((SELECT auth.uid()), article_id));

DROP POLICY IF EXISTS kb_run_items_select_staff ON public.kb_checklist_run_items;
CREATE POLICY kb_run_items_select_staff ON public.kb_checklist_run_items FOR SELECT TO authenticated
  USING (public.is_internal_staff((SELECT auth.uid()))
         AND (NOT public.kb_is_driver_only((SELECT auth.uid()))
              OR EXISTS (SELECT 1 FROM public.kb_checklist_runs r
                         WHERE r.id = kb_checklist_run_items.run_id AND r.user_id = (SELECT auth.uid()))));