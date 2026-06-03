
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_box_my_bike boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS box_my_bike_status text,
  ADD COLUMN IF NOT EXISTS box_label_url text,
  ADD COLUMN IF NOT EXISTS box_label_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS box_label_uploaded_by uuid,
  ADD COLUMN IF NOT EXISTS box_my_bike_invoice_id text,
  ADD COLUMN IF NOT EXISTS box_my_bike_invoice_number text,
  ADD COLUMN IF NOT EXISTS box_my_bike_invoice_url text,
  ADD COLUMN IF NOT EXISTS box_in_depot_at timestamptz,
  ADD COLUMN IF NOT EXISTS box_boxed_at timestamptz,
  ADD COLUMN IF NOT EXISTS box_label_printed_at timestamptz,
  ADD COLUMN IF NOT EXISTS box_collected_by_3p_at timestamptz;

-- Allow order owner (customer) to update their own order's label fields via existing UPDATE policy
-- (orders UPDATE policy already permits user_id = auth.uid()).

-- Customer policy on storage.objects for box-my-bike-labels bucket
-- (bucket created via storage tool separately)
