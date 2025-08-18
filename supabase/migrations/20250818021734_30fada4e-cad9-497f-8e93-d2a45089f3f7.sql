-- Create API keys table
CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  key_name text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- RLS policies for API keys
CREATE POLICY "Admins can manage all API keys"
ON public.api_keys
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Users can view their own API keys"
ON public.api_keys
FOR SELECT
USING (auth.uid() = user_id);

-- Function to generate API key for a customer (admin only)
CREATE OR REPLACE FUNCTION public.admin_generate_api_key(
  customer_id uuid,
  key_name text
)
RETURNS TABLE(api_key text, key_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_admin boolean;
  key_uuid uuid;
  random_key text;
  key_prefix text;
  full_key text;
  key_hash text;
BEGIN
  -- Check if current user is admin
  SELECT (role = 'admin') INTO is_admin 
  FROM public.profiles 
  WHERE id = auth.uid();
  
  IF NOT is_admin THEN
    RAISE EXCEPTION 'Only admins can generate API keys';
  END IF;
  
  -- Check if customer exists
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = customer_id) THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;
  
  -- Generate key components
  key_uuid := gen_random_uuid();
  random_key := encode(gen_random_bytes(32), 'hex');
  key_prefix := 'cc_' || substring(customer_id::text from 1 for 8);
  full_key := key_prefix || '_' || random_key;
  
  -- Hash the key for storage
  key_hash := encode(digest(full_key, 'sha256'), 'hex');
  
  -- Insert the API key
  INSERT INTO public.api_keys (id, user_id, key_name, key_hash, key_prefix)
  VALUES (key_uuid, customer_id, key_name, key_hash, key_prefix);
  
  -- Return the plaintext key (only time it's visible)
  RETURN QUERY SELECT full_key, key_uuid;
END;
$$;

-- Function to verify API key and get user
CREATE OR REPLACE FUNCTION public.verify_api_key(api_key text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  found_user_id uuid;
  key_hash text;
BEGIN
  -- Hash the provided key
  key_hash := encode(digest(api_key, 'sha256'), 'hex');
  
  -- Find matching active key and update last_used_at
  UPDATE public.api_keys 
  SET last_used_at = now()
  WHERE key_hash = verify_api_key.key_hash 
    AND is_active = true
  RETURNING user_id INTO found_user_id;
  
  RETURN found_user_id;
END;
$$;

-- Function to revoke API key (admin only)
CREATE OR REPLACE FUNCTION public.admin_revoke_api_key(key_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;