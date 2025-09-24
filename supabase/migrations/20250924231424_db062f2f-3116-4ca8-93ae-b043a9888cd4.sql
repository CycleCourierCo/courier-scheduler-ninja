-- Add loaded onto van tracking fields to orders table
ALTER TABLE public.orders
ADD COLUMN loaded_onto_van boolean DEFAULT false,
ADD COLUMN loaded_onto_van_at timestamp with time zone;