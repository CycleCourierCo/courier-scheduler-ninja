
-- Add new columns to route_predictions
ALTER TABLE public.route_predictions
ADD COLUMN IF NOT EXISTS ai_proposed_routes jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS validated_routes jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS planning_mode text DEFAULT 'v1',
ADD COLUMN IF NOT EXISTS unassigned_stops jsonb DEFAULT '[]'::jsonb;

-- Create route_group_scores table
CREATE TABLE public.route_group_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id uuid REFERENCES public.route_predictions(id) ON DELETE CASCADE NOT NULL,
  group_label text NOT NULL,
  archetype_id uuid REFERENCES public.route_archetypes(id) ON DELETE SET NULL,
  similarity_score numeric DEFAULT 0,
  compactness_score numeric DEFAULT 0,
  corridor_fit numeric DEFAULT 0,
  fill_efficiency numeric DEFAULT 0,
  selected boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.route_group_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "route_group_scores_select_policy" ON public.route_group_scores
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM (SELECT auth.uid() AS uid) s
  WHERE has_role(s.uid, 'admin') OR has_role(s.uid, 'route_planner')
));

CREATE POLICY "route_group_scores_insert_policy" ON public.route_group_scores
FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM (SELECT auth.uid() AS uid) s
  WHERE has_role(s.uid, 'admin')
));

CREATE POLICY "route_group_scores_update_policy" ON public.route_group_scores
FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM (SELECT auth.uid() AS uid) s
  WHERE has_role(s.uid, 'admin')
))
WITH CHECK (EXISTS (
  SELECT 1 FROM (SELECT auth.uid() AS uid) s
  WHERE has_role(s.uid, 'admin')
));

CREATE POLICY "route_group_scores_delete_policy" ON public.route_group_scores
FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM (SELECT auth.uid() AS uid) s
  WHERE has_role(s.uid, 'admin')
));

-- Create planner_route_overrides table
CREATE TABLE public.planner_route_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id uuid REFERENCES public.route_predictions(id) ON DELETE CASCADE NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  action text NOT NULL,
  from_day text,
  from_slot integer,
  to_day text,
  to_slot integer,
  reason text,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.planner_route_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planner_route_overrides_select_policy" ON public.planner_route_overrides
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM (SELECT auth.uid() AS uid) s
  WHERE has_role(s.uid, 'admin') OR has_role(s.uid, 'route_planner')
));

CREATE POLICY "planner_route_overrides_insert_policy" ON public.planner_route_overrides
FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM (SELECT auth.uid() AS uid) s
  WHERE has_role(s.uid, 'admin') OR has_role(s.uid, 'route_planner')
));

CREATE POLICY "planner_route_overrides_update_policy" ON public.planner_route_overrides
FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM (SELECT auth.uid() AS uid) s
  WHERE has_role(s.uid, 'admin')
))
WITH CHECK (EXISTS (
  SELECT 1 FROM (SELECT auth.uid() AS uid) s
  WHERE has_role(s.uid, 'admin')
));

CREATE POLICY "planner_route_overrides_delete_policy" ON public.planner_route_overrides
FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM (SELECT auth.uid() AS uid) s
  WHERE has_role(s.uid, 'admin')
));
