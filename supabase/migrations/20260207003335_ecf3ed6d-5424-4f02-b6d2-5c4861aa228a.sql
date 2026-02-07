-- Add created_via_api boolean column to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS created_via_api BOOLEAN NOT NULL DEFAULT false;