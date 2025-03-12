
-- Add new columns for specific scheduled dates
ALTER TABLE IF EXISTS public.orders
ADD COLUMN scheduled_pickup_date timestamptz,
ADD COLUMN scheduled_delivery_date timestamptz;
