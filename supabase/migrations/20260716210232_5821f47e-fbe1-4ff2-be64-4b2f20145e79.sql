
ALTER TABLE public.bicycle_inspections
  ADD COLUMN IF NOT EXISTS bike_type TEXT;

ALTER TABLE public.inspection_issues
  ADD COLUMN IF NOT EXISTS repair_id TEXT REFERENCES public.labour_times(repair_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS inspection_issues_repair_id_idx
  ON public.inspection_issues(repair_id);
