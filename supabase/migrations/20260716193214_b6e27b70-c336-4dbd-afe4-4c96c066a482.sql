
ALTER TABLE public.inspection_issues
  ADD COLUMN IF NOT EXISTS parts_cost numeric,
  ADD COLUMN IF NOT EXISTS labour_cost numeric;

CREATE OR REPLACE FUNCTION public.sync_inspection_issue_estimated_cost()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.parts_cost IS NOT NULL OR NEW.labour_cost IS NOT NULL THEN
    NEW.estimated_cost := COALESCE(NEW.parts_cost, 0) + COALESCE(NEW.labour_cost, 0);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_inspection_issue_estimated_cost ON public.inspection_issues;
CREATE TRIGGER trg_sync_inspection_issue_estimated_cost
  BEFORE INSERT OR UPDATE OF parts_cost, labour_cost ON public.inspection_issues
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_inspection_issue_estimated_cost();
