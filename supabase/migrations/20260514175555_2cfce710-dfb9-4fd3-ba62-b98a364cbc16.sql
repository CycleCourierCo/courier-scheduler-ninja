ALTER TABLE public.inspection_issues
  ADD COLUMN parts_ordered boolean NOT NULL DEFAULT false,
  ADD COLUMN parts_ordered_at timestamptz,
  ADD COLUMN parts_ordered_by_id uuid,
  ADD COLUMN parts_ordered_by_name text;

-- Backfill: any issue already marked parts_arrived must have been ordered too
UPDATE public.inspection_issues
SET parts_ordered = true,
    parts_ordered_at = COALESCE(parts_arrived_at, now()),
    parts_ordered_by_id = parts_arrived_by_id,
    parts_ordered_by_name = parts_arrived_by_name
WHERE parts_arrived = true;