-- Categories
CREATE TABLE public.kb_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  icon text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_categories TO authenticated;
GRANT ALL ON public.kb_categories TO service_role;
ALTER TABLE public.kb_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kb_categories_select_staff" ON public.kb_categories FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "kb_categories_insert_staff" ON public.kb_categories FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_staff(auth.uid()));
CREATE POLICY "kb_categories_update_staff" ON public.kb_categories FOR UPDATE TO authenticated
  USING (public.is_internal_staff(auth.uid())) WITH CHECK (public.is_internal_staff(auth.uid()));
CREATE POLICY "kb_categories_delete_admin" ON public.kb_categories FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::user_role));

-- Articles
CREATE TABLE public.kb_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.kb_categories(id) ON DELETE SET NULL,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  summary text,
  body text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'published',
  tags text[] NOT NULL DEFAULT '{}',
  related_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  updated_by uuid,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_articles TO authenticated;
GRANT ALL ON public.kb_articles TO service_role;
ALTER TABLE public.kb_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kb_articles_select_staff" ON public.kb_articles FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "kb_articles_insert_staff" ON public.kb_articles FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_staff(auth.uid()));
CREATE POLICY "kb_articles_update_staff" ON public.kb_articles FOR UPDATE TO authenticated
  USING (public.is_internal_staff(auth.uid())) WITH CHECK (public.is_internal_staff(auth.uid()));
CREATE POLICY "kb_articles_delete_admin" ON public.kb_articles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::user_role));

CREATE INDEX kb_articles_category_idx ON public.kb_articles(category_id);

-- Versions
CREATE TABLE public.kb_article_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.kb_articles(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  summary text,
  edited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.kb_article_versions TO authenticated;
GRANT ALL ON public.kb_article_versions TO service_role;
ALTER TABLE public.kb_article_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kb_article_versions_select_staff" ON public.kb_article_versions FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));

CREATE INDEX kb_article_versions_article_idx ON public.kb_article_versions(article_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.kb_snapshot_article_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.body IS DISTINCT FROM OLD.body OR NEW.title IS DISTINCT FROM OLD.title THEN
    INSERT INTO public.kb_article_versions(article_id, title, body, summary, edited_by)
    VALUES (OLD.id, OLD.title, OLD.body, OLD.summary, auth.uid());
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER kb_articles_version_trigger
BEFORE UPDATE ON public.kb_articles
FOR EACH ROW EXECUTE FUNCTION public.kb_snapshot_article_version();

CREATE TRIGGER kb_categories_updated_at
BEFORE UPDATE ON public.kb_categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Checklist items
CREATE TABLE public.kb_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.kb_articles(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  text text NOT NULL,
  guidance text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_checklist_items TO authenticated;
GRANT ALL ON public.kb_checklist_items TO service_role;
ALTER TABLE public.kb_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kb_checklist_items_select_staff" ON public.kb_checklist_items FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "kb_checklist_items_insert_staff" ON public.kb_checklist_items FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_staff(auth.uid()));
CREATE POLICY "kb_checklist_items_update_staff" ON public.kb_checklist_items FOR UPDATE TO authenticated
  USING (public.is_internal_staff(auth.uid())) WITH CHECK (public.is_internal_staff(auth.uid()));
CREATE POLICY "kb_checklist_items_delete_staff" ON public.kb_checklist_items FOR DELETE TO authenticated
  USING (public.is_internal_staff(auth.uid()));

CREATE INDEX kb_checklist_items_article_idx ON public.kb_checklist_items(article_id, position);

CREATE TRIGGER kb_checklist_items_updated_at
BEFORE UPDATE ON public.kb_checklist_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Runs
CREATE TABLE public.kb_checklist_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.kb_articles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  label text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_checklist_runs TO authenticated;
GRANT ALL ON public.kb_checklist_runs TO service_role;
ALTER TABLE public.kb_checklist_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kb_runs_select_staff" ON public.kb_checklist_runs FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "kb_runs_insert_own" ON public.kb_checklist_runs FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_staff(auth.uid()) AND user_id = auth.uid());
CREATE POLICY "kb_runs_update_own_or_admin" ON public.kb_checklist_runs FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::user_role));
CREATE POLICY "kb_runs_delete_own_or_admin" ON public.kb_checklist_runs FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::user_role));

CREATE INDEX kb_runs_article_idx ON public.kb_checklist_runs(article_id, started_at DESC);

CREATE TRIGGER kb_runs_updated_at
BEFORE UPDATE ON public.kb_checklist_runs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Run items
CREATE TABLE public.kb_checklist_run_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.kb_checklist_runs(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.kb_checklist_items(id) ON DELETE SET NULL,
  position integer NOT NULL DEFAULT 0,
  text text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  note text,
  completed_by uuid,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_checklist_run_items TO authenticated;
GRANT ALL ON public.kb_checklist_run_items TO service_role;
ALTER TABLE public.kb_checklist_run_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kb_run_items_select_staff" ON public.kb_checklist_run_items FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "kb_run_items_insert_own" ON public.kb_checklist_run_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.kb_checklist_runs r WHERE r.id = run_id
    AND (r.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::user_role))));
CREATE POLICY "kb_run_items_update_own" ON public.kb_checklist_run_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.kb_checklist_runs r WHERE r.id = run_id
    AND (r.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::user_role))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.kb_checklist_runs r WHERE r.id = run_id
    AND (r.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::user_role))));
CREATE POLICY "kb_run_items_delete_own" ON public.kb_checklist_run_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.kb_checklist_runs r WHERE r.id = run_id
    AND (r.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::user_role))));

CREATE INDEX kb_run_items_run_idx ON public.kb_checklist_run_items(run_id, position);

CREATE TRIGGER kb_run_items_updated_at
BEFORE UPDATE ON public.kb_checklist_run_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed categories
INSERT INTO public.kb_categories (name, slug, description, icon, sort_order) VALUES
  ('Route Planning', 'route-planning', 'Daily planning, route builder, timeslots and CSV imports', 'Map', 1),
  ('Customer Service', 'customer-service', 'Inbox, chasers, updates, complaints and claims', 'MessageSquare', 2),
  ('Drivers', 'drivers', 'Daily driver routine, timeslips, fuel and proof of delivery', 'Truck', 3),
  ('Workshop & Inspections', 'workshop-inspections', 'Inspections, repairs, pricing and invoicing', 'Wrench', 4),
  ('Loading & Storage', 'loading-storage', 'Storage bays, allocation and bike searches', 'Boxes', 5),
  ('Northern Ireland', 'northern-ireland', 'Outbound and inbound NI orders and ferry hand-off', 'Ship', 6),
  ('Invoicing & Finance', 'invoicing-finance', 'Weekly batches, individual invoices and fixes', 'Receipt', 7),
  ('Onboarding & Admin', 'onboarding-admin', 'Roles, access and adding new staff', 'UserPlus', 8);
