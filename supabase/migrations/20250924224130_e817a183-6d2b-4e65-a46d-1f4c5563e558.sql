-- Add storage location fields to orders table
ALTER TABLE public.orders 
ADD COLUMN storage_locations jsonb DEFAULT NULL;