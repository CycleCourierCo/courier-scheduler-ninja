-- Fix ambiguous key_hash reference in verify_api_key function
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
  -- Hash the provided key
  input_key_hash := encode(digest(api_key, 'sha256'), 'hex');
  
  -- Find matching active key and update last_used_at
  UPDATE public.api_keys 
  SET last_used_at = now()
  WHERE api_keys.key_hash = input_key_hash 
    AND is_active = true
  RETURNING user_id INTO found_user_id;
  
  RETURN found_user_id;
END;
$function$;