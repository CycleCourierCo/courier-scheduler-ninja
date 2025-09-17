-- Fix the orders SELECT RLS policy to remove the security-bypassing "OR true" clause
DROP POLICY IF EXISTS "Consolidated orders SELECT policy" ON public.orders;

CREATE POLICY "Consolidated orders SELECT policy" 
ON public.orders 
FOR SELECT 
USING (
  -- Admins can see all orders
  (get_user_role(auth.uid()) = 'admin'::user_role) OR 
  -- Users can see their own orders  
  (auth.uid() = user_id)
);