CREATE OR REPLACE FUNCTION public.verify_api_key(api_key text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  found_user_id uuid;
  input_key_hash text;
BEGIN
  -- Hash the provided key using standard sha256
  input_key_hash := encode(sha256(api_key::bytea), 'hex');
  
  -- Add debug logging
  RAISE NOTICE 'API Key verification - Input key prefix: %, Hash: %', substring(api_key, 1, 20), substring(input_key_hash, 1, 20);
  
  -- Find matching active key and update last_used_at
  UPDATE public.api_keys 
  SET last_used_at = now()
  WHERE api_keys.key_hash = input_key_hash 
    AND is_active = true
  RETURNING user_id INTO found_user_id;
  
  -- Log result
  RAISE NOTICE 'API Key verification result - User ID: %', found_user_id;
  
  RETURN found_user_id;
END;
$function$;