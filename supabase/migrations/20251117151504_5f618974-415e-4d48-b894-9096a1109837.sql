-- Create a SECURITY DEFINER wrapper function to safely create webhook secrets in Vault
CREATE OR REPLACE FUNCTION public.create_webhook_secret(
  p_secret text,
  p_name text
) RETURNS uuid
LANGUAGE SQL
SECURITY DEFINER
SET search_path = 'public', 'vault'
AS $$
  SELECT vault.create_secret(p_secret, p_name, 'Webhook secret');
$$;