CREATE TYPE public.review_type AS ENUM ('probation','monthly','quarterly','six_month','annual','ad_hoc');
CREATE TYPE public.review_stage AS ENUM ('draft','self_assessment','manager_assessment','review_meeting','objectives','employee_response','signed_off');
CREATE TYPE public.review_source AS ENUM ('self','manager');
CREATE TYPE public.review_category AS ENUM ('performance','behaviour');
CREATE TYPE public.review_action_owner AS ENUM ('employee','manager');
CREATE TYPE public.review_action_status AS ENUM ('not_started','in_progress','complete');
CREATE TYPE public.review_agreement AS ENUM ('agree','agree_with_comments','disagree');

CREATE TABLE public.review_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid,
  review_type public.review_type NOT NULL DEFAULT 'quarterly',
  period_start date NOT NULL,
  period_end date NOT NULL,
  review_date date,
  stage public.review_stage NOT NULL DEFAULT 'draft',
  meeting_notes text,
  employee_agreement public.review_agreement,
  employee_comments text,
  employee_requests_discussion boolean NOT NULL DEFAULT false,
  employee_acknowledged_at timestamptz,
  performance_score numeric(4,2),
  behaviour_score numeric(4,2),
  overall_score numeric(4,2),
  self_overall_score numeric(4,2),
  self_submitted_at timestamptz,
  manager_submitted_at timestamptz,
  signed_off_at timestamptz,
  signed_off_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_review_cycles_employee ON public.review_cycles(employee_id, period_end DESC);
CREATE INDEX idx_review_cycles_reviewer ON public.review_cycles(reviewer_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_cycles TO authenticated;
GRANT ALL ON public.review_cycles TO service_role;
ALTER TABLE public.review_cycles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.review_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL REFERENCES public.review_cycles(id) ON DELETE CASCADE,
  competency_key text NOT NULL,
  category public.review_category NOT NULL DEFAULT 'behaviour',
  source public.review_source NOT NULL,
  score smallint,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cycle_id, competency_key, source)
);
CREATE INDEX idx_review_ratings_cycle ON public.review_ratings(cycle_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_ratings TO authenticated;
GRANT ALL ON public.review_ratings TO service_role;
ALTER TABLE public.review_ratings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.review_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL REFERENCES public.review_cycles(id) ON DELETE CASCADE,
  question_key text NOT NULL,
  source public.review_source NOT NULL,
  answer text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cycle_id, question_key, source)
);
CREATE INDEX idx_review_responses_cycle ON public.review_responses(cycle_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_responses TO authenticated;
GRANT ALL ON public.review_responses TO service_role;
ALTER TABLE public.review_responses ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.review_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL REFERENCES public.review_cycles(id) ON DELETE CASCADE,
  description text NOT NULL,
  owner public.review_action_owner NOT NULL DEFAULT 'employee',
  due_date date,
  status public.review_action_status NOT NULL DEFAULT 'not_started',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_review_actions_cycle ON public.review_actions(cycle_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_actions TO authenticated;
GRANT ALL ON public.review_actions TO service_role;
ALTER TABLE public.review_actions ENABLE ROW LEVEL SECURITY;

-- Helper predicates -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_manage_review(_cycle_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.review_cycles c
    WHERE c.id = _cycle_id
      AND (
        public.is_admin()
        OR (c.reviewer_id = (SELECT auth.uid()) AND c.stage <> 'signed_off')
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.can_view_review(_cycle_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.review_cycles c
    WHERE c.id = _cycle_id
      AND (
        public.is_admin()
        OR c.reviewer_id = (SELECT auth.uid())
        OR (c.employee_id = (SELECT auth.uid()) AND c.stage <> 'draft')
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.is_review_employee_stage(_cycle_id uuid, _stages public.review_stage[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.review_cycles c
    WHERE c.id = _cycle_id
      AND c.employee_id = (SELECT auth.uid())
      AND c.stage = ANY(_stages)
  )
$$;

-- review_cycles policies ------------------------------------------------------
CREATE POLICY "review_cycles_select" ON public.review_cycles FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR reviewer_id = (SELECT auth.uid())
  OR (employee_id = (SELECT auth.uid()) AND stage <> 'draft')
);

CREATE POLICY "review_cycles_insert" ON public.review_cycles FOR INSERT TO authenticated
WITH CHECK (public.is_admin() OR reviewer_id = (SELECT auth.uid()));

CREATE POLICY "review_cycles_update_manager" ON public.review_cycles FOR UPDATE TO authenticated
USING (public.is_admin() OR (reviewer_id = (SELECT auth.uid()) AND stage <> 'signed_off'))
WITH CHECK (public.is_admin() OR reviewer_id = (SELECT auth.uid()));

CREATE POLICY "review_cycles_update_employee" ON public.review_cycles FOR UPDATE TO authenticated
USING (employee_id = (SELECT auth.uid()) AND stage IN ('self_assessment','employee_response'))
WITH CHECK (employee_id = (SELECT auth.uid()) AND stage IN ('self_assessment','employee_response','signed_off'));

CREATE POLICY "review_cycles_delete" ON public.review_cycles FOR DELETE TO authenticated
USING (public.is_admin());

-- review_ratings policies -----------------------------------------------------
CREATE POLICY "review_ratings_select" ON public.review_ratings FOR SELECT TO authenticated
USING (public.can_view_review(cycle_id));

CREATE POLICY "review_ratings_manager_write" ON public.review_ratings FOR ALL TO authenticated
USING (public.can_manage_review(cycle_id))
WITH CHECK (public.can_manage_review(cycle_id));

CREATE POLICY "review_ratings_employee_insert" ON public.review_ratings FOR INSERT TO authenticated
WITH CHECK (source = 'self' AND public.is_review_employee_stage(cycle_id, ARRAY['self_assessment']::public.review_stage[]));

CREATE POLICY "review_ratings_employee_update" ON public.review_ratings FOR UPDATE TO authenticated
USING (source = 'self' AND public.is_review_employee_stage(cycle_id, ARRAY['self_assessment']::public.review_stage[]))
WITH CHECK (source = 'self' AND public.is_review_employee_stage(cycle_id, ARRAY['self_assessment']::public.review_stage[]));

-- review_responses policies ---------------------------------------------------
CREATE POLICY "review_responses_select" ON public.review_responses FOR SELECT TO authenticated
USING (public.can_view_review(cycle_id));

CREATE POLICY "review_responses_manager_write" ON public.review_responses FOR ALL TO authenticated
USING (public.can_manage_review(cycle_id))
WITH CHECK (public.can_manage_review(cycle_id));

CREATE POLICY "review_responses_employee_insert" ON public.review_responses FOR INSERT TO authenticated
WITH CHECK (
  source = 'self'
  AND public.is_review_employee_stage(cycle_id, ARRAY['self_assessment','employee_response']::public.review_stage[])
);

CREATE POLICY "review_responses_employee_update" ON public.review_responses FOR UPDATE TO authenticated
USING (source = 'self' AND public.is_review_employee_stage(cycle_id, ARRAY['self_assessment','employee_response']::public.review_stage[]))
WITH CHECK (source = 'self' AND public.is_review_employee_stage(cycle_id, ARRAY['self_assessment','employee_response']::public.review_stage[]));

-- review_actions policies -----------------------------------------------------
CREATE POLICY "review_actions_select" ON public.review_actions FOR SELECT TO authenticated
USING (public.can_view_review(cycle_id));

CREATE POLICY "review_actions_manager_write" ON public.review_actions FOR ALL TO authenticated
USING (public.can_manage_review(cycle_id))
WITH CHECK (public.can_manage_review(cycle_id));

-- Validation & timestamps -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_review_rating()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.score IS NOT NULL AND (NEW.score < 1 OR NEW.score > 5) THEN
    RAISE EXCEPTION 'Rating score must be between 1 and 5';
  END IF;
  IF NEW.source = 'manager' AND NEW.score IS NOT NULL AND NEW.score <> 3
     AND (NEW.comment IS NULL OR btrim(NEW.comment) = '') THEN
    RAISE EXCEPTION 'A written explanation is required for scores of 1, 2, 4 or 5';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_review_rating
BEFORE INSERT OR UPDATE ON public.review_ratings
FOR EACH ROW EXECUTE FUNCTION public.validate_review_rating();

CREATE TRIGGER trg_review_cycles_updated_at BEFORE UPDATE ON public.review_cycles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_review_ratings_updated_at BEFORE UPDATE ON public.review_ratings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_review_responses_updated_at BEFORE UPDATE ON public.review_responses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_review_actions_updated_at BEFORE UPDATE ON public.review_actions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();