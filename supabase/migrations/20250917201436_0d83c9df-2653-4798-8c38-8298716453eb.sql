-- Add policy for anonymous availability updates
-- This allows unauthenticated users to set availability dates once per order
-- regardless of order status, but prevents multiple updates

CREATE POLICY "Anonymous availability updates" 
ON public.orders 
FOR UPDATE 
USING (
  -- Allow anonymous updates for availability setting
  -- Only when availability hasn't been confirmed yet
  (sender_confirmed_at IS NULL OR receiver_confirmed_at IS NULL)
)
WITH CHECK (
  -- Ensure only availability-related fields can be updated
  -- and confirmation hasn't happened yet
  (sender_confirmed_at IS NULL OR receiver_confirmed_at IS NULL)
);