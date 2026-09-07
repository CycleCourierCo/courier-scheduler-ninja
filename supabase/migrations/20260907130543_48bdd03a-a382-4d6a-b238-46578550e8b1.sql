ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS held_by_driver_name text,
  ADD COLUMN IF NOT EXISTS held_by_driver_at timestamptz;