
ALTER TABLE public.bicycle_inspections
  ADD COLUMN IF NOT EXISTS frame_cleaned_at timestamptz,
  ADD COLUMN IF NOT EXISTS frame_cleaned_by_id uuid,
  ADD COLUMN IF NOT EXISTS frame_cleaned_by_name text,
  ADD COLUMN IF NOT EXISTS drivetrain_degreased_at timestamptz,
  ADD COLUMN IF NOT EXISTS drivetrain_degreased_by_id uuid,
  ADD COLUMN IF NOT EXISTS drivetrain_degreased_by_name text;
