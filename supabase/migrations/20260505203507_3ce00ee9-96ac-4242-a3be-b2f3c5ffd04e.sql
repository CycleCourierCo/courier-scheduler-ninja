ALTER TABLE public.claims
  DROP COLUMN IF EXISTS customer_name,
  DROP COLUMN IF EXISTS customer_email,
  DROP COLUMN IF EXISTS customer_phone,
  DROP COLUMN IF EXISTS collection_date,
  DROP COLUMN IF EXISTS delivery_date,
  DROP COLUMN IF EXISTS route_name,
  DROP COLUMN IF EXISTS driver_name,
  DROP COLUMN IF EXISTS bike_make_model,
  DROP COLUMN IF EXISTS declared_value,
  DROP COLUMN IF EXISTS has_upgrades,
  DROP COLUMN IF EXISTS upgrades_notes;

ALTER TABLE public.claims ALTER COLUMN order_id SET NOT NULL;