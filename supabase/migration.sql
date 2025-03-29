
-- Add new columns for specific scheduled dates
ALTER TABLE IF EXISTS public.orders
ADD COLUMN scheduled_pickup_date timestamptz,
ADD COLUMN scheduled_delivery_date timestamptz;

-- Add new columns for sender and receiver notes
ALTER TABLE IF EXISTS public.orders
ADD COLUMN sender_notes text,
ADD COLUMN receiver_notes text;

-- Add address fields to the profiles table
ALTER TABLE IF EXISTS public.profiles
ADD COLUMN address_line_1 text,
ADD COLUMN address_line_2 text,
ADD COLUMN city text,
ADD COLUMN postal_code text;
