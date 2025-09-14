-- Add column to track when delivery confirmation emails were sent
ALTER TABLE public.orders 
ADD COLUMN delivery_confirmation_sent_at TIMESTAMP WITH TIME ZONE;