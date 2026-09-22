ALTER TABLE public.route_plans
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'joint';

CREATE INDEX IF NOT EXISTS route_plans_mode_status_idx
  ON public.route_plans (mode, status);