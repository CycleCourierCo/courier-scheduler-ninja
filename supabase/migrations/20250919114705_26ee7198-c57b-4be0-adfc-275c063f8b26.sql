-- Fix the orders UPDATE policy to allow anonymous availability updates
DROP POLICY IF EXISTS "Optimized orders UPDATE policy" ON public.orders;
DROP POLICY IF EXISTS "Anonymous availability updates" ON public.orders;

-- Create a single comprehensive UPDATE policy that handles both authenticated and anonymous users
CREATE POLICY "Comprehensive orders UPDATE policy" ON public.orders 
FOR UPDATE 
USING (
  -- Admin can update any order
  (get_user_role(auth.uid()) = 'admin'::user_role) 
  OR 
  -- Order owner can update their own orders with status restrictions
  (
    auth.uid() = user_id 
    AND (
      (status = 'created'::order_status) 
      OR (status = 'sender_availability_pending'::order_status) 
      OR (status = 'receiver_availability_pending'::order_status)
    )
  )
  OR
  -- Anonymous users can update availability before confirmation
  (
    auth.uid() IS NULL 
    AND (
      (sender_confirmed_at IS NULL) 
      OR (receiver_confirmed_at IS NULL)
    )
  )
)
WITH CHECK (
  -- Admin can update any order
  (get_user_role(auth.uid()) = 'admin'::user_role) 
  OR 
  -- Order owner can update their own orders with status restrictions
  (
    auth.uid() = user_id 
    AND (
      (status = 'created'::order_status) 
      OR (status = 'sender_availability_pending'::order_status) 
      OR (status = 'receiver_availability_pending'::order_status)
      OR (status = 'sender_availability_confirmed'::order_status)
      OR (status = 'receiver_availability_confirmed'::order_status)
      OR (status = 'scheduled_dates_pending'::order_status)
    )
  )
  OR
  -- Anonymous users can update availability before confirmation
  (
    auth.uid() IS NULL 
    AND (
      (sender_confirmed_at IS NULL) 
      OR (receiver_confirmed_at IS NULL)
    )
  )
);