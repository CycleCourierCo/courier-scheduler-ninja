CREATE TABLE public.clean_air_zones (
  slug text PRIMARY KEY,
  name text NOT NULL,
  daily_charge numeric NOT NULL DEFAULT 0,
  pay_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.clean_air_zones TO authenticated;
GRANT ALL ON public.clean_air_zones TO service_role;
ALTER TABLE public.clean_air_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read zones" ON public.clean_air_zones FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = (SELECT auth.uid()) AND ur.role::text = 'admin'));
CREATE POLICY "Admins update zones" ON public.clean_air_zones FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = (SELECT auth.uid()) AND ur.role::text = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = (SELECT auth.uid()) AND ur.role::text = 'admin'));

INSERT INTO public.clean_air_zones (slug, name, daily_charge, pay_url) VALUES
('bath','Bath',9,'https://www.gov.uk/clean-air-zones'),
('birmingham','Birmingham',9,'https://www.brumbreathes.co.uk/'),
('bradford','Bradford',9,'https://www.gov.uk/clean-air-zones'),
('bristol','Bristol',9,'https://www.gov.uk/clean-air-zones'),
('portsmouth','Portsmouth',0,'https://www.gov.uk/clean-air-zones'),
('sheffield','Sheffield',9,'https://www.gov.uk/clean-air-zones'),
('tyneside','Tyneside (Newcastle & Gateshead)',9,'https://www.gov.uk/clean-air-zones');

CREATE TABLE public.caz_vehicle_exemptions (
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  zone_slug text NOT NULL REFERENCES public.clean_air_zones(slug) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (vehicle_id, zone_slug)
);
GRANT SELECT, INSERT, DELETE ON public.caz_vehicle_exemptions TO authenticated;
GRANT ALL ON public.caz_vehicle_exemptions TO service_role;
ALTER TABLE public.caz_vehicle_exemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage exemptions" ON public.caz_vehicle_exemptions FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = (SELECT auth.uid()) AND ur.role::text = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = (SELECT auth.uid()) AND ur.role::text = 'admin'));

CREATE TABLE public.caz_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  driver_id uuid,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  timeslip_id uuid REFERENCES public.timeslips(id) ON DELETE SET NULL,
  zone_slug text NOT NULL REFERENCES public.clean_air_zones(slug),
  charge numeric NOT NULL DEFAULT 0,
  exempt boolean NOT NULL DEFAULT false,
  dedupe_key text NOT NULL UNIQUE,
  paid_at timestamptz,
  paid_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX caz_charges_date_idx ON public.caz_charges(date);
GRANT SELECT, UPDATE ON public.caz_charges TO authenticated;
GRANT ALL ON public.caz_charges TO service_role;
ALTER TABLE public.caz_charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read charges" ON public.caz_charges FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = (SELECT auth.uid()) AND ur.role::text = 'admin'));
CREATE POLICY "Admins mark paid" ON public.caz_charges FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = (SELECT auth.uid()) AND ur.role::text = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = (SELECT auth.uid()) AND ur.role::text = 'admin'));

CREATE OR REPLACE FUNCTION public.invoke_caz_daily_check()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s text;
BEGIN
  s := get_cron_secret();
  PERFORM net.http_post(
    url := 'https://axigtrmaxhetyfzjjdve.supabase.co/functions/v1/caz-daily-check',
    headers := jsonb_build_object('Content-Type','application/json','X-Cron-Secret', s),
    body := '{}'::jsonb
  );
END; $$;
REVOKE ALL ON FUNCTION public.invoke_caz_daily_check() FROM PUBLIC, anon, authenticated;

-- 05:00 UTC = 06:00 BST / 05:00 GMT; checks the previous London day.
SELECT cron.schedule('caz-daily-check', '0 5 * * *', $$SELECT public.invoke_caz_daily_check();$$);