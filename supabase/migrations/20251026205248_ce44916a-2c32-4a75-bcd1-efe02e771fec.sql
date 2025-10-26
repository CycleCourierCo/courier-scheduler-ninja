-- Phase 1: Create user_roles table and security definer function
-- Reuse existing user_role enum type

-- Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role user_role NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role user_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Migrate existing roles from profiles to user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, role 
FROM public.profiles 
WHERE role IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- RLS policies for user_roles table
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Update existing RLS policies to use has_role() function
-- Drop old policies and recreate with has_role()

-- API Keys table policies
DROP POLICY IF EXISTS "Consolidated api_keys ALL policy" ON public.api_keys;
CREATE POLICY "Admins can manage all API keys"
ON public.api_keys
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Drivers table policies
DROP POLICY IF EXISTS "Admins can do all on drivers" ON public.drivers;
CREATE POLICY "Admins can manage drivers"
ON public.drivers
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Drivers can view their own record" ON public.drivers;
CREATE POLICY "Drivers can view their own record"
ON public.drivers
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid() 
      AND public.has_role(auth.uid(), 'driver')
      AND profiles.email = drivers.email
  )
);

-- Jobs table policies
DROP POLICY IF EXISTS "Consolidated jobs ALL policy" ON public.jobs;
CREATE POLICY "Admins can manage jobs"
ON public.jobs
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Order comments policies
DROP POLICY IF EXISTS "Admins can insert order comments" ON public.order_comments;
CREATE POLICY "Admins can insert order comments"
ON public.order_comments
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view all order comments" ON public.order_comments;
CREATE POLICY "Admins can view all order comments"
ON public.order_comments
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update their own comments" ON public.order_comments;
CREATE POLICY "Admins can update their own comments"
ON public.order_comments
FOR UPDATE
USING (admin_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete their own comments" ON public.order_comments;
CREATE POLICY "Admins can delete their own comments"
ON public.order_comments
FOR DELETE
USING (admin_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));

-- Orders table policies
DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
CREATE POLICY "Admins can delete orders"
ON public.orders
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Loaders can update loading fields" ON public.orders;
CREATE POLICY "Loaders can update loading fields"
ON public.orders
FOR UPDATE
USING (public.has_role(auth.uid(), 'loader'))
WITH CHECK (public.has_role(auth.uid(), 'loader'));

-- Update complex policies that reference get_user_role
-- Keep using get_user_role for now as it reads from profiles.role (backward compatible)
-- These will be updated in Phase 2 after we verify everything works

-- Routes table policies
DROP POLICY IF EXISTS "Admins can do all on routes" ON public.routes;
CREATE POLICY "Admins can manage routes"
ON public.routes
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Timeslips table policies
DROP POLICY IF EXISTS "Admins can view all timeslips" ON public.timeslips;
CREATE POLICY "Admins can view all timeslips"
ON public.timeslips
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert timeslips" ON public.timeslips;
CREATE POLICY "Admins can insert timeslips"
ON public.timeslips
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update timeslips" ON public.timeslips;
CREATE POLICY "Admins can update timeslips"
ON public.timeslips
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete timeslips" ON public.timeslips;
CREATE POLICY "Admins can delete timeslips"
ON public.timeslips
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Drivers can view their approved timeslips" ON public.timeslips;
CREATE POLICY "Drivers can view their approved timeslips"
ON public.timeslips
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    JOIN drivers d ON d.email = p.email
    WHERE p.id = auth.uid() 
      AND public.has_role(auth.uid(), 'driver')
      AND d.id = timeslips.driver_id 
      AND timeslips.status = 'approved'
  )
);

-- Update admin_update_account_status function to use has_role
CREATE OR REPLACE FUNCTION public.admin_update_account_status(user_id uuid, status text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if the current user is an admin using has_role
  IF public.has_role(auth.uid(), 'admin') THEN
    UPDATE profiles 
    SET 
      account_status = status::account_status_type,
      updated_at = now()
    WHERE id = user_id;
    
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$function$;

-- Update get_business_accounts_for_admin function
CREATE OR REPLACE FUNCTION public.get_business_accounts_for_admin()
RETURNS SETOF profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if the current user is an admin using has_role
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN QUERY SELECT * FROM profiles 
    WHERE is_business = true OR role = 'b2b_customer'
    ORDER BY created_at DESC;
  ELSE
    RETURN QUERY SELECT * FROM profiles WHERE 1=0;
  END IF;
END;
$function$;

-- Update is_admin function to use has_role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN public.has_role(auth.uid(), 'admin');
END;
$function$;

-- Update is_current_user_admin function
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.has_role(auth.uid(), 'admin')
$function$;

-- Note: profiles.role column is kept for backward compatibility
-- It will be removed in Phase 2 after verification period