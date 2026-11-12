ALTER TABLE public.lost_found_items
  ALTER COLUMN created_by DROP NOT NULL,
  ADD COLUMN source text NOT NULL DEFAULT 'staff' CHECK (source IN ('staff','customer')),
  ADD COLUMN reporter_name text CHECK (reporter_name IS NULL OR length(reporter_name) <= 120),
  ADD COLUMN reporter_email text CHECK (reporter_email IS NULL OR length(reporter_email) <= 255),
  ADD COLUMN reporter_phone text CHECK (reporter_phone IS NULL OR length(reporter_phone) <= 40);
CREATE INDEX lost_found_items_source_idx ON public.lost_found_items(source, created_at DESC);