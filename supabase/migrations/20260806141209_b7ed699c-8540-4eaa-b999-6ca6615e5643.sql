ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS ni_direction text;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_ni_direction_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_ni_direction_check
  CHECK (ni_direction IS NULL OR ni_direction IN ('outbound','inbound'));

UPDATE public.orders
SET ni_direction = 'outbound'
WHERE is_northern_ireland = true AND ni_direction IS NULL;