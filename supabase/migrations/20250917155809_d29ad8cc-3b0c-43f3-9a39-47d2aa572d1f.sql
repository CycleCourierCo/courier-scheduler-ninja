-- Fix function search path vulnerabilities by setting search_path = 'public' for all functions

-- 1. Update the update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 2. Update the is_admin function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  RETURN (
    SELECT role = 'admin'
    FROM public.profiles
    WHERE id = auth.uid()
  );
END;
$function$;

-- 3. Update the get_user_role function
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT role FROM public.profiles WHERE id = user_id
$function$;

-- 4. Update the is_account_approved function
CREATE OR REPLACE FUNCTION public.is_account_approved(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = user_id
      AND (account_status = 'approved' OR role = 'admin')
  );
$function$;

-- 5. Update the admin_update_account_status function
CREATE OR REPLACE FUNCTION public.admin_update_account_status(user_id uuid, status text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  is_admin boolean;
BEGIN
  -- Check if the current user is an admin
  SELECT (role = 'admin') INTO is_admin FROM profiles WHERE id = auth.uid();
  
  -- Only allow admins to update other accounts
  IF is_admin THEN
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

-- 6. Update the get_business_accounts_for_admin function
CREATE OR REPLACE FUNCTION public.get_business_accounts_for_admin()
RETURNS SETOF profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Check if the current user is an admin
  IF EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    -- Return all business accounts OR accounts with b2b_customer role
    RETURN QUERY SELECT * FROM profiles 
    WHERE is_business = true OR role = 'b2b_customer'
    ORDER BY created_at DESC;
  ELSE
    -- If not admin, return empty set
    RETURN QUERY SELECT * FROM profiles WHERE 1=0;
  END IF;
END;
$function$;

-- 7. Update the admin_revoke_api_key function
CREATE OR REPLACE FUNCTION public.admin_revoke_api_key(key_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  is_admin boolean;
BEGIN
  -- Check if current user is admin
  SELECT (role = 'admin') INTO is_admin 
  FROM public.profiles 
  WHERE id = auth.uid();
  
  IF NOT is_admin THEN
    RAISE EXCEPTION 'Only admins can revoke API keys';
  END IF;
  
  -- Revoke the key
  UPDATE public.api_keys 
  SET is_active = false, updated_at = now()
  WHERE id = key_id;
  
  RETURN FOUND;
END;
$function$;