-- Fix admin_generate_webhook_secret to allow vault access
CREATE OR REPLACE FUNCTION public.admin_generate_webhook_secret(
  p_user_id uuid, 
  p_name text, 
  p_endpoint_url text, 
  p_events text[]
)
RETURNS TABLE(webhook_secret text, config_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'vault'
AS $$
DECLARE
  v_is_admin boolean;
  v_config_id uuid;
  v_random_key text;
  v_prefix text;
  v_full_secret text;
  v_secret_hash text;
  v_vault_key text;
BEGIN
  -- Check admin
  SELECT has_role(auth.uid(), 'admin') INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Only admins can generate webhook secrets';
  END IF;
  
  -- Generate secret components
  v_config_id := gen_random_uuid();
  v_random_key := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_prefix := 'wh_' || substring(p_user_id::text from 1 for 8);
  v_full_secret := v_prefix || '_' || v_random_key;
  v_secret_hash := encode(sha256(v_full_secret::bytea), 'hex');
  
  -- Store plaintext secret in Vault
  v_vault_key := 'webhook_secret_' || v_config_id::text;
  INSERT INTO vault.secrets (name, secret)
  VALUES (v_vault_key, v_full_secret);
  
  -- Insert webhook config with hash for reference
  INSERT INTO public.webhook_configurations (
    id, user_id, name, endpoint_url, secret_hash, secret_prefix, events
  ) VALUES (
    v_config_id, p_user_id, p_name, p_endpoint_url, v_secret_hash, v_prefix, p_events
  );
  
  RETURN QUERY SELECT v_full_secret, v_config_id;
END;
$$;