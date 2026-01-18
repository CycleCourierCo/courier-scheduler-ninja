-- Add bike_type column to orders table
ALTER TABLE public.orders
ADD COLUMN bike_type text;