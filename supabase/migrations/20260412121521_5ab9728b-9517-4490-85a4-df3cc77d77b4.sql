
-- Create fuel_cards table
CREATE TABLE public.fuel_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_name text NOT NULL,
  price_per_litre numeric NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fuel_cards ENABLE ROW LEVEL SECURITY;

-- RLS: Authenticated users can SELECT
CREATE POLICY "fuel_cards_select_policy"
  ON public.fuel_cards
  FOR SELECT
  TO authenticated
  USING (true);

-- RLS: Admin full CRUD
CREATE POLICY "fuel_cards_admin_insert_policy"
  ON public.fuel_cards
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role)
  ));

CREATE POLICY "fuel_cards_admin_update_policy"
  ON public.fuel_cards
  FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role)
  ));

CREATE POLICY "fuel_cards_admin_delete_policy"
  ON public.fuel_cards
  FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role)
  ));

-- Trigger for updated_at
CREATE TRIGGER update_fuel_cards_updated_at
  BEFORE UPDATE ON public.fuel_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Cron wrapper function
CREATE OR REPLACE FUNCTION public.invoke_fuel_finder_refresh()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  cron_secret TEXT;
BEGIN
  cron_secret := get_cron_secret();
  
  PERFORM net.http_post(
    url := 'https://axigtrmaxhetyfzjjdve.supabase.co/functions/v1/fuel-finder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4aWd0cm1heGhldHlmempqZHZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE3NDA4MDMsImV4cCI6MjA1NzMxNjgwM30.POm5myoyMwKjkMfYMw2gRFs-cgD7GDznv338qiadugg',
      'X-Cron-Secret', cron_secret
    ),
    body := '{"mode": "refresh"}'::jsonb
  );
END;
$$;

-- Schedule daily at 5:00 AM UTC (≈ 5/6 AM UK time)
SELECT cron.schedule(
  'daily-fuel-price-refresh',
  '0 5 * * *',
  $$SELECT public.invoke_fuel_finder_refresh();$$
);
