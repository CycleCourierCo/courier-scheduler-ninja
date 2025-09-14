-- Add timeslot fields to orders table
ALTER TABLE public.orders 
ADD COLUMN pickup_timeslot TIME,
ADD COLUMN delivery_timeslot TIME;