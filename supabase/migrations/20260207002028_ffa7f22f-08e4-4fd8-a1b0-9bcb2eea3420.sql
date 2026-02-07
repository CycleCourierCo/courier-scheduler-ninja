-- Remove OptimoRoute columns from orders table
ALTER TABLE public.orders 
DROP COLUMN IF EXISTS optimoroute_pickup_id,
DROP COLUMN IF EXISTS optimoroute_delivery_id;