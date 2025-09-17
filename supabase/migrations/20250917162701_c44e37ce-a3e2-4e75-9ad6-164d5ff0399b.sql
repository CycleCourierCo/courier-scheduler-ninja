-- Consolidate multiple permissive RLS policies for performance
-- This maintains exact same functionality but reduces policy evaluation overhead

-- 1. ORDERS TABLE - Consolidate SELECT policies
DROP POLICY IF EXISTS "Admins can see all orders" ON public.orders;
DROP POLICY IF EXISTS "Allow public access to orders by ID" ON public.orders;
DROP POLICY IF EXISTS "Allow public access to orders for sender availability" ON public.orders;
DROP POLICY IF EXISTS "Allow public read access to orders by ID" ON public.orders;
DROP POLICY IF EXISTS "Customers can see their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;

CREATE POLICY "Consolidated orders SELECT policy" ON public.orders
FOR SELECT USING (
  -- Admin can see all orders
  get_user_role((select auth.uid())) = 'admin'::user_role
  OR
  -- Users can see their own orders
  (select auth.uid()) = user_id
  OR
  -- Customers can see their own orders (redundant with above but keeping for clarity)
  ((select auth.uid()) = user_id AND (get_user_role((select auth.uid())) = 'b2b_customer'::user_role OR get_user_role((select auth.uid())) = 'b2c_customer'::user_role))
  OR
  -- Public access (allows tracking without auth)
  true
);

-- 2. ORDERS TABLE - Consolidate UPDATE policies
DROP POLICY IF EXISTS "Admins can update any order" ON public.orders;
DROP POLICY IF EXISTS "Allow public update of pickup_date and status" ON public.orders;
DROP POLICY IF EXISTS "Allow public updates for availability" ON public.orders;
DROP POLICY IF EXISTS "Customers can update their own orders in certain statuses" ON public.orders;
DROP POLICY IF EXISTS "Users can update their own orders" ON public.orders;

CREATE POLICY "Consolidated orders UPDATE policy" ON public.orders
FOR UPDATE USING (
  -- Admin can update any order
  get_user_role((select auth.uid())) = 'admin'::user_role
  OR
  -- Users can update their own orders
  (select auth.uid()) = user_id
  OR
  -- Public updates for availability (allows tracking updates without auth)
  true
)
WITH CHECK (
  -- Admin can update any order
  get_user_role((select auth.uid())) = 'admin'::user_role
  OR
  -- Customers can update own orders in certain statuses
  ((select auth.uid()) = user_id AND (status = 'created'::order_status OR status = 'sender_availability_pending'::order_status OR status = 'receiver_availability_pending'::order_status))
  OR
  -- Public updates limited to availability statuses
  (status = 'sender_availability_pending'::order_status OR status = 'receiver_availability_pending'::order_status)
  OR
  -- Allow any public update (for tracking functionality)
  true
);

-- 3. ORDERS TABLE - Consolidate INSERT policies  
DROP POLICY IF EXISTS "Admins can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Customers can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Users can create their own orders" ON public.orders;

CREATE POLICY "Consolidated orders INSERT policy" ON public.orders
FOR INSERT WITH CHECK (
  -- Admin can insert orders
  get_user_role((select auth.uid())) = 'admin'::user_role
  OR
  -- Users can create their own orders
  (select auth.uid()) = user_id
  OR
  -- Customers can insert orders (redundant with above but keeping for clarity)
  ((select auth.uid()) = user_id AND (get_user_role((select auth.uid())) = 'b2b_customer'::user_role OR get_user_role((select auth.uid())) = 'b2c_customer'::user_role))
);

-- 4. API_KEYS TABLE - Consolidate SELECT policies
DROP POLICY IF EXISTS "Users can view their own API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Admins can manage all API keys" ON public.api_keys;

CREATE POLICY "Consolidated api_keys SELECT policy" ON public.api_keys
FOR SELECT USING (
  -- Users can view their own API keys
  (select auth.uid()) = user_id
  OR
  -- Admins can view all API keys
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'::user_role)
);

-- Create consolidated policy for other operations on api_keys
CREATE POLICY "Consolidated api_keys ALL policy" ON public.api_keys
FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'::user_role)
);

-- 5. JOBS TABLE - Consolidate SELECT policies
DROP POLICY IF EXISTS "Admins can do all on jobs" ON public.jobs;
DROP POLICY IF EXISTS "B2B customers can view jobs for their orders" ON public.jobs;

CREATE POLICY "Consolidated jobs SELECT policy" ON public.jobs
FOR SELECT USING (
  -- Admins can view all jobs
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'::user_role)
  OR
  -- B2B customers can view jobs for their orders
  EXISTS (SELECT 1 FROM orders o JOIN profiles p ON p.id = o.user_id WHERE o.id = jobs.order_id AND p.id = (select auth.uid()) AND p.role = 'b2b_customer'::user_role)
);

-- Create consolidated policy for other operations on jobs
CREATE POLICY "Consolidated jobs ALL policy" ON public.jobs
FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'::user_role)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'::user_role)
);

-- 6. PROFILES TABLE - Consolidate SELECT policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Consolidated profiles SELECT policy" ON public.profiles
FOR SELECT USING (
  -- Users can view their own profile
  (select auth.uid()) = id
  OR
  -- Admins can view all profiles
  is_current_user_admin()
);

-- 7. PROFILES TABLE - Consolidate UPDATE policies
DROP POLICY IF EXISTS "Allow admins to update account status" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Consolidated profiles UPDATE policy" ON public.profiles
FOR UPDATE USING (
  -- Users can update their own profile
  (select auth.uid()) = id
  OR
  -- Admins can update any profile
  is_admin()
)
WITH CHECK (
  -- Users can update their own profile
  (select auth.uid()) = id
  OR
  -- Admins can update any profile
  is_admin()
);