ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS purchase_mileage integer,
  ADD COLUMN IF NOT EXISTS sold_date date,
  ADD COLUMN IF NOT EXISTS sold_mileage integer,
  ADD COLUMN IF NOT EXISTS clean_air_zones boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tyne_tunnel boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mersey_tunnel boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS humber_bridge boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tamar_bridge boolean NOT NULL DEFAULT false;