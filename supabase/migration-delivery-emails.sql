
-- Add delivery_emails_sent column to track if delivery confirmation emails have been sent
ALTER TABLE IF EXISTS public.orders
ADD COLUMN IF NOT EXISTS delivery_emails_sent BOOLEAN DEFAULT FALSE;

-- Update existing delivered orders to mark them as having had emails sent
UPDATE public.orders 
SET delivery_emails_sent = TRUE 
WHERE status = 'delivered';
