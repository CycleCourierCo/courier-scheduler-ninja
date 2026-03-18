
-- Table 1: postcode_patterns - Historical stats cache
CREATE TABLE public.postcode_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  postcode_prefix text NOT NULL UNIQUE,
  total_jobs integer NOT NULL DEFAULT 0,
  sample_size integer NOT NULL DEFAULT 0,
  median_days_to_collection numeric,
  median_days_to_delivery numeric,
  p90_days_to_collection numeric,
  p90_days_to_delivery numeric,
  collection_day_frequency jsonb DEFAULT '{}'::jsonb,
  delivery_day_frequency jsonb DEFAULT '{}'::jsonb,
  cancel_reschedule_rate numeric DEFAULT 0,
  avg_stop_density_nearby numeric DEFAULT 0,
  common_sender_receiver_pairings jsonb DEFAULT '[]'::jsonb,
  weekday_route_inclusion_rate jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.postcode_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "postcode_patterns_select_policy" ON public.postcode_patterns
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role) OR has_role(s.uid, 'route_planner'::user_role)
  ));

CREATE POLICY "postcode_patterns_insert_policy" ON public.postcode_patterns
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role)
  ));

CREATE POLICY "postcode_patterns_update_policy" ON public.postcode_patterns
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role)
  ));

CREATE POLICY "postcode_patterns_delete_policy" ON public.postcode_patterns
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role)
  ));

-- Table 2: route_predictions - Stored AI plans
CREATE TABLE public.route_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  driver_count integer NOT NULL,
  date_range_start date NOT NULL,
  date_range_end date NOT NULL,
  pending_job_count integer NOT NULL DEFAULT 0,
  predicted_routes jsonb DEFAULT '[]'::jsonb,
  optimized_routes jsonb,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.route_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "route_predictions_select_policy" ON public.route_predictions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role) OR has_role(s.uid, 'route_planner'::user_role)
  ));

CREATE POLICY "route_predictions_insert_policy" ON public.route_predictions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role) OR has_role(s.uid, 'route_planner'::user_role)
  ));

CREATE POLICY "route_predictions_update_policy" ON public.route_predictions
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role) OR has_role(s.uid, 'route_planner'::user_role)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role) OR has_role(s.uid, 'route_planner'::user_role)
  ));

CREATE POLICY "route_predictions_delete_policy" ON public.route_predictions
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role)
  ));

-- Table 3: route_prediction_runs - Feedback/evaluation logging
CREATE TABLE public.route_prediction_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id uuid REFERENCES public.route_predictions(id) ON DELETE CASCADE NOT NULL,
  model_used text NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  prompt_version text NOT NULL DEFAULT 'v1',
  pending_jobs_hash text,
  validation_passed boolean NOT NULL DEFAULT false,
  validation_errors jsonb DEFAULT '[]'::jsonb,
  fallback_used boolean NOT NULL DEFAULT false,
  ai_tokens_used integer,
  compare_scenario_metadata jsonb,
  acceptance_outcome text,
  planner_overrides_count integer DEFAULT 0,
  actual_miles numeric,
  actual_duration_minutes integer,
  jobs_completed integer,
  jobs_deferred integer,
  failed_collections integer,
  failed_deliveries integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.route_prediction_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "route_prediction_runs_select_policy" ON public.route_prediction_runs
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role)
  ));

CREATE POLICY "route_prediction_runs_insert_policy" ON public.route_prediction_runs
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role) OR has_role(s.uid, 'route_planner'::user_role)
  ));

CREATE POLICY "route_prediction_runs_update_policy" ON public.route_prediction_runs
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role)
  ));

-- Triggers for updated_at
CREATE TRIGGER update_postcode_patterns_updated_at
  BEFORE UPDATE ON public.postcode_patterns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_route_predictions_updated_at
  BEFORE UPDATE ON public.route_predictions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
