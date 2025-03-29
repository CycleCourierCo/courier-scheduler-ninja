
-- Add address fields to the profiles table
ALTER TABLE IF EXISTS public.profiles
ADD COLUMN address_line_1 text,
ADD COLUMN address_line_2 text,
ADD COLUMN city text,
ADD COLUMN postal_code text;

