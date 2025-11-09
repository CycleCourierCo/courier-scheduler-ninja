-- Create webhook_configurations table
CREATE TABLE public.webhook_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  endpoint_url text NOT NULL,
  secret_hash text NOT NULL,
  secret_prefix text NOT NULL,
  is_active boolean DEFAULT true,
  events text[] DEFAULT '{}',
  last_triggered_at timestamptz,
  last_delivery_status text,
  last_error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.webhook_configurations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own webhooks"
  ON public.webhook_configurations FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all webhooks"
  ON public.webhook_configurations FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Create webhook_delivery_logs table
CREATE TABLE public.webhook_delivery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_config_id uuid REFERENCES public.webhook_configurations(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  response_status integer,
  response_body text,
  delivery_duration_ms integer,
  attempt_number integer DEFAULT 1,
  delivered_at timestamptz DEFAULT now(),
  success boolean DEFAULT false
);

ALTER TABLE public.webhook_delivery_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their webhook logs"
  ON public.webhook_delivery_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM webhook_configurations wc
      WHERE wc.id = webhook_config_id
      AND (wc.user_id = auth.uid() OR has_role(auth.uid(), 'admin'))
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_webhook_configurations_updated_at
  BEFORE UPDATE ON public.webhook_configurations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate webhook secret
CREATE OR REPLACE FUNCTION public.admin_generate_webhook_secret(
  p_user_id uuid,
  p_name text,
  p_endpoint_url text,
  p_events text[]
)
RETURNS TABLE(webhook_secret text, config_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_is_admin boolean;
  v_config_id uuid;
  v_random_key text;
  v_prefix text;
  v_full_secret text;
  v_secret_hash text;
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
  
  -- Insert webhook config
  INSERT INTO public.webhook_configurations (
    id, user_id, name, endpoint_url, secret_hash, secret_prefix, events
  ) VALUES (
    v_config_id, p_user_id, p_name, p_endpoint_url, v_secret_hash, v_prefix, p_events
  );
  
  RETURN QUERY SELECT v_full_secret, v_config_id;
END;
$$;

-- Function to revoke webhook
CREATE OR REPLACE FUNCTION public.admin_revoke_webhook(p_config_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can revoke webhooks';
  END IF;
  
  UPDATE public.webhook_configurations
  SET is_active = false, updated_at = now()
  WHERE id = p_config_id;
  
  RETURN FOUND;
END;
$$;