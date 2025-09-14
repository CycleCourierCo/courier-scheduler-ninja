-- Fix gen_random_bytes by using gen_random_uuid and extract bytes
CREATE OR REPLACE FUNCTION public.admin_generate_api_key(customer_id uuid, key_name text)
 RETURNS TABLE(api_key text, key_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- Use multiple UUIDs to create a long random string
  random_key := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  key_prefix := 'cc_' || substring(customer_id::text from 1 for 8);
  full_key := key_prefix || '_' || random_key;
  
  -- Hash the key for storage using crypto_hash_sha256
  key_hash := encode(crypto_hash_sha256(full_key::bytea), 'hex');
  
  -- Insert the API key
  INSERT INTO public.api_keys (id, user_id, key_name, key_hash, key_prefix)
  VALUES (key_uuid, customer_id, key_name, key_hash, key_prefix);
  
  -- Return the plaintext key (only time it's visible)
  RETURN QUERY SELECT full_key, key_uuid;
END;
$function$;