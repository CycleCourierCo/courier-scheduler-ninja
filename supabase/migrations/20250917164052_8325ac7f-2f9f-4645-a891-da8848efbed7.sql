-- Fix RLS Policy Performance and Security Issues

-- 1. Drop redundant SELECT policies for api_keys (keeping only user-specific access)
DROP POLICY IF EXISTS "Consolidated api_keys SELECT policy" ON public.api_keys;

-- 2. Drop redundant SELECT policies for jobs (keeping only user-specific access)  
DROP POLICY IF EXISTS "Consolidated jobs SELECT policy" ON public.jobs;

-- 3. Fix orders SELECT policy to optimize auth.uid() calls
DROP POLICY IF EXISTS "Consolidated orders SELECT policy" ON public.orders;
CREATE POLICY "Optimized orders SELECT policy" 
ON public.orders 
FOR SELECT 
USING (
  (get_user_role((select auth.uid())) = 'admin'::user_role) OR 
  ((select auth.uid()) = user_id)
);

-- 4. Fix orders UPDATE policy to remove security risk and optimize auth calls
DROP POLICY IF EXISTS "Consolidated orders UPDATE policy" ON public.orders;
CREATE POLICY "Optimized orders UPDATE policy" 
ON public.orders 
FOR UPDATE 
USING (
  (get_user_role((select auth.uid())) = 'admin'::user_role) OR 
  ((select auth.uid()) = user_id)
)
WITH CHECK (
  (get_user_role((select auth.uid())) = 'admin'::user_role) OR 
  (((select auth.uid()) = user_id) AND (
    (status = 'created'::order_status) OR 
    (status = 'sender_availability_pending'::order_status) OR 
    (status = 'receiver_availability_pending'::order_status)
  ))
);

-- 5. Create optimized user-specific SELECT policy for api_keys
CREATE POLICY "Users can view their own API keys" 
ON public.api_keys 
FOR SELECT 
USING ((select auth.uid()) = user_id);

-- 6. Create optimized user-specific SELECT policy for jobs
CREATE POLICY "Users can view jobs for their orders" 
ON public.jobs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM orders o 
    WHERE o.id = jobs.order_id 
    AND o.user_id = (select auth.uid())
  )
);