-- Add OptimoRoute order ID columns for collection and delivery
ALTER TABLE orders
ADD COLUMN optimoroute_pickup_id text,
ADD COLUMN optimoroute_delivery_id text;