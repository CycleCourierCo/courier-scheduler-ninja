ALTER TABLE public.bicycle_inspections
  ADD COLUMN IF NOT EXISTS external_provider text,
  ADD COLUMN IF NOT EXISTS external_inspection_id text,
  ADD COLUMN IF NOT EXISTS external_report_url text,
  ADD COLUMN IF NOT EXISTS external_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS external_completed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_bicycle_inspections_external_inspection_id
  ON public.bicycle_inspections (external_inspection_id)
  WHERE external_inspection_id IS NOT NULL;

ALTER TABLE public.inspection_issues
  ADD COLUMN IF NOT EXISTS external_fault_id text,
  ADD COLUMN IF NOT EXISTS external_synced_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_inspection_issues_external_fault_id
  ON public.inspection_issues (external_fault_id)
  WHERE external_fault_id IS NOT NULL;