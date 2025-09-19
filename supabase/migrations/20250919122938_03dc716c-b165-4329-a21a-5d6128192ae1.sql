-- Drop the existing comprehensive policy that's causing issues
DROP POLICY IF EXISTS "Comprehensive orders UPDATE policy" ON public.orders;

-- Create a new policy that properly allows anonymous availability updates
CREATE POLICY "Orders UPDATE for users and availability" ON public.orders
FOR UPDATE USING (
  -- Admins can update anything
  (get_user_role(auth.uid()) = 'admin'::user_role) 
  OR 
  -- Users can update their own orders in certain states
  ((auth.uid() = user_id) AND (
    status = 'created'::order_status OR 
    status = 'sender_availability_pending'::order_status OR 
    status = 'receiver_availability_pending'::order_status
  ))
  OR
  -- Anonymous users can update for availability confirmation
  (auth.uid() IS NULL AND (
    sender_confirmed_at IS NULL OR 
    receiver_confirmed_at IS NULL OR
    status = 'sender_availability_pending'::order_status OR
    status = 'receiver_availability_pending'::order_status
  ))
) 
WITH CHECK (
  -- Admins can update anything
  (get_user_role(auth.uid()) = 'admin'::user_role) 
  OR 
  -- Users can update their own orders in certain states
  ((auth.uid() = user_id) AND (
    status = 'created'::order_status OR 
    status = 'sender_availability_pending'::order_status OR 
    status = 'receiver_availability_pending'::order_status OR 
    status = 'sender_availability_confirmed'::order_status OR 
    status = 'receiver_availability_confirmed'::order_status OR 
    status = 'scheduled_dates_pending'::order_status
  ))
  OR
  -- Anonymous users can update for availability confirmation
  (auth.uid() IS NULL AND (
    sender_confirmed_at IS NULL OR 
    receiver_confirmed_at IS NULL OR
    status = 'sender_availability_pending'::order_status OR
    status = 'receiver_availability_pending'::order_status OR
    status = 'sender_availability_confirmed'::order_status OR
    status = 'receiver_availability_confirmed'::order_status OR
    status = 'scheduled_dates_pending'::order_status
  ))
);