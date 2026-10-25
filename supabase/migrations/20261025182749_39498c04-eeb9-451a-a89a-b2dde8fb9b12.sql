ALTER TABLE public.vehicle_issues
  ADD COLUMN IF NOT EXISTS is_breakdown boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS breakdown_at timestamptz,
  ADD COLUMN IF NOT EXISTS breakdown_location text,
  ADD COLUMN IF NOT EXISTS breakdown_driver text,
  ADD COLUMN IF NOT EXISTS breakdown_route text,
  ADD COLUMN IF NOT EXISTS recovery_provider text,
  ADD COLUMN IF NOT EXISTS recovery_cost numeric;