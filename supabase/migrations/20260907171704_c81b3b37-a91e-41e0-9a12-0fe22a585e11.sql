CREATE TABLE public.inspection_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inspection_id UUID NOT NULL REFERENCES public.bicycle_inspections(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  author_name TEXT NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_inspection_comments_inspection ON public.inspection_comments(inspection_id);
CREATE INDEX idx_inspection_comments_order ON public.inspection_comments(order_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspection_comments TO authenticated;
GRANT ALL ON public.inspection_comments TO service_role;

ALTER TABLE public.inspection_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal staff can view inspection comments"
ON public.inspection_comments FOR SELECT TO authenticated
USING (public.is_internal_staff((SELECT auth.uid())));

CREATE POLICY "Internal staff can add inspection comments"
ON public.inspection_comments FOR INSERT TO authenticated
WITH CHECK (public.is_internal_staff((SELECT auth.uid())) AND author_id = (SELECT auth.uid()));

CREATE POLICY "Authors or admins can update inspection comments"
ON public.inspection_comments FOR UPDATE TO authenticated
USING (author_id = (SELECT auth.uid()) OR public.is_admin())
WITH CHECK (author_id = (SELECT auth.uid()) OR public.is_admin());

CREATE POLICY "Authors or admins can delete inspection comments"
ON public.inspection_comments FOR DELETE TO authenticated
USING (author_id = (SELECT auth.uid()) OR public.is_admin());

CREATE TRIGGER update_inspection_comments_updated_at
BEFORE UPDATE ON public.inspection_comments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();