ALTER TABLE public.warehouse_stock ADD COLUMN IF NOT EXISTS frame_size text;
ALTER TABLE public.bike_builds ADD COLUMN IF NOT EXISTS frame_size text;
ALTER TABLE public.bike_build_template_items ADD COLUMN IF NOT EXISTS frame_size text;