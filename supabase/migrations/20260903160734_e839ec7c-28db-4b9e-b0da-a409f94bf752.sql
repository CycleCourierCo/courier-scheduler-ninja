ALTER TABLE public.bicycle_inspections
  ADD COLUMN IF NOT EXISTS identity_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS identity_matches boolean,
  ADD COLUMN IF NOT EXISTS actual_bike_brand text,
  ADD COLUMN IF NOT EXISTS actual_bike_model text,
  ADD COLUMN IF NOT EXISTS actual_frame_size text,
  ADD COLUMN IF NOT EXISTS identity_notes text,
  ADD COLUMN IF NOT EXISTS identity_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS identity_reviewed_by_id uuid,
  ADD COLUMN IF NOT EXISTS identity_reviewed_by_name text;

ALTER TABLE public.inspection_issues
  ADD COLUMN IF NOT EXISTS decline_notified_at timestamptz;