-- Fix RLS performance issues by optimizing auth.uid() calls
-- Replace auth.uid() with (select auth.uid()) in all RLS policies

-- 1. Orders table policies
DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
CREATE POLICY "Admins can delete orders" ON public.orders
FOR DELETE USING (get_user_role((select auth.uid())) = 'admin'::user_role);

DROP POLICY IF EXISTS "Admins can insert orders" ON public.orders;
CREATE POLICY "Admins can insert orders" ON public.orders
FOR INSERT WITH CHECK (get_user_role((select auth.uid())) = 'admin'::user_role);

DROP POLICY IF EXISTS "Admins can see all orders" ON public.orders;
CREATE POLICY "Admins can see all orders" ON public.orders
FOR SELECT USING (get_user_role((select auth.uid())) = 'admin'::user_role);

DROP POLICY IF EXISTS "Admins can update any order" ON public.orders;
CREATE POLICY "Admins can update any order" ON public.orders
FOR UPDATE USING (get_user_role((select auth.uid())) = 'admin'::user_role);

DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
CREATE POLICY "Users can view their own orders" ON public.orders
FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Customers can insert orders" ON public.orders;
CREATE POLICY "Customers can insert orders" ON public.orders
FOR INSERT WITH CHECK (((select auth.uid()) = user_id) AND ((get_user_role((select auth.uid())) = 'b2b_customer'::user_role) OR (get_user_role((select auth.uid())) = 'b2c_customer'::user_role)));

DROP POLICY IF EXISTS "Customers can see their own orders" ON public.orders;
CREATE POLICY "Customers can see their own orders" ON public.orders
FOR SELECT USING (((select auth.uid()) = user_id) AND ((get_user_role((select auth.uid())) = 'b2b_customer'::user_role) OR (get_user_role((select auth.uid())) = 'b2c_customer'::user_role)));

DROP POLICY IF EXISTS "Customers can update their own orders in certain statuses" ON public.orders;
CREATE POLICY "Customers can update their own orders in certain statuses" ON public.orders
FOR UPDATE USING ((select auth.uid()) = user_id)
WITH CHECK ((status = 'created'::order_status) OR (status = 'sender_availability_pending'::order_status) OR (status = 'receiver_availability_pending'::order_status));

DROP POLICY IF EXISTS "Users can create their own orders" ON public.orders;
CREATE POLICY "Users can create their own orders" ON public.orders
FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own orders" ON public.orders;
CREATE POLICY "Users can update their own orders" ON public.orders
FOR UPDATE USING ((select auth.uid()) = user_id);

-- 2. Profiles table policies
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
FOR UPDATE USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
FOR SELECT USING ((select auth.uid()) = id);

-- 3. Order comments table policies
DROP POLICY IF EXISTS "Admins can delete their own comments" ON public.order_comments;
CREATE POLICY "Admins can delete their own comments" ON public.order_comments
FOR DELETE USING ((admin_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role)))));

DROP POLICY IF EXISTS "Admins can insert order comments" ON public.order_comments;
CREATE POLICY "Admins can insert order comments" ON public.order_comments
FOR INSERT WITH CHECK (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role))));

DROP POLICY IF EXISTS "Admins can update their own comments" ON public.order_comments;
CREATE POLICY "Admins can update their own comments" ON public.order_comments
FOR UPDATE USING ((admin_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role)))));

DROP POLICY IF EXISTS "Admins can view all order comments" ON public.order_comments;
CREATE POLICY "Admins can view all order comments" ON public.order_comments
FOR SELECT USING (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role))));

-- 4. API Keys table policies
DROP POLICY IF EXISTS "Users can view their own API keys" ON public.api_keys;
CREATE POLICY "Users can view their own API keys" ON public.api_keys
FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Admins can manage all API keys" ON public.api_keys;
CREATE POLICY "Admins can manage all API keys" ON public.api_keys
FOR ALL USING (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role))));

-- 5. Drivers table policies
DROP POLICY IF EXISTS "Admins can do all on drivers" ON public.drivers;
CREATE POLICY "Admins can do all on drivers" ON public.drivers
FOR ALL USING (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role))))
WITH CHECK (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role))));

-- 6. Jobs table policies
DROP POLICY IF EXISTS "Admins can do all on jobs" ON public.jobs;
CREATE POLICY "Admins can do all on jobs" ON public.jobs
FOR ALL USING (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role))))
WITH CHECK (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role))));

DROP POLICY IF EXISTS "B2B customers can view jobs for their orders" ON public.jobs;
CREATE POLICY "B2B customers can view jobs for their orders" ON public.jobs
FOR SELECT USING (EXISTS ( SELECT 1
   FROM (orders o
     JOIN profiles p ON ((p.id = o.user_id)))
  WHERE ((o.id = jobs.order_id) AND (p.id = (select auth.uid())) AND (p.role = 'b2b_customer'::user_role))));

-- 7. Routes table policies
DROP POLICY IF EXISTS "Admins can do all on routes" ON public.routes;
CREATE POLICY "Admins can do all on routes" ON public.routes
FOR ALL USING (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role))))
WITH CHECK (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::user_role))));

-- 8. QuickBooks tokens table policies
DROP POLICY IF EXISTS "Users can view their own QuickBooks tokens" ON public.quickbooks_tokens;
CREATE POLICY "Users can view their own QuickBooks tokens" ON public.quickbooks_tokens
FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own QuickBooks tokens" ON public.quickbooks_tokens;
CREATE POLICY "Users can insert their own QuickBooks tokens" ON public.quickbooks_tokens
FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own QuickBooks tokens" ON public.quickbooks_tokens;
CREATE POLICY "Users can update their own QuickBooks tokens" ON public.quickbooks_tokens
FOR UPDATE USING ((select auth.uid()) = user_id);

-- 9. Invoice history table policies
DROP POLICY IF EXISTS "Users can view their own invoice history" ON public.invoice_history;
CREATE POLICY "Users can view their own invoice history" ON public.invoice_history
FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own invoice history" ON public.invoice_history;
CREATE POLICY "Users can delete their own invoice history" ON public.invoice_history
FOR DELETE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own invoice history" ON public.invoice_history;
CREATE POLICY "Users can insert their own invoice history" ON public.invoice_history
FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own invoice history" ON public.invoice_history;
CREATE POLICY "Users can update their own invoice history" ON public.invoice_history
FOR UPDATE USING ((select auth.uid()) = user_id);

-- 10. OAuth states table policies
DROP POLICY IF EXISTS "Users can manage their own OAuth states" ON public.oauth_states;
CREATE POLICY "Users can manage their own OAuth states" ON public.oauth_states
FOR ALL USING ((select auth.uid()) = user_id);