-- lovable-cron-fallback-reviewed: Radius offers no webhook or history API; sampling every 2 min is the only way to build a driven path for deviation checks.
CREATE TABLE public.fleet_position_history (
  id bigserial PRIMARY KEY,
  vehicle_id uuid,
  registration text NOT NULL,
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  speed integer,
  ignition boolean,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fleet_position_history TO authenticated;
GRANT ALL ON public.fleet_position_history TO service_role;
GRANT USAGE ON SEQUENCE public.fleet_position_history_id_seq TO service_role;
ALTER TABLE public.fleet_position_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Fleet staff read position history" ON public.fleet_position_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.is_fleet_staff(s.uid)));
CREATE INDEX fleet_position_history_reg_time ON public.fleet_position_history (registration, recorded_at);
CREATE INDEX fleet_position_history_time ON public.fleet_position_history (recorded_at);

CREATE OR REPLACE FUNCTION public.fleet_route_day(p_date date)
RETURNS TABLE(timeslip_id uuid, vehicle_id uuid, registration text, driver_name text, job_locations jsonb, mileage numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_fleet_staff(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT t.id, t.vehicle_id, v.registration::text, p.name::text, to_jsonb(t.job_locations), t.mileage::numeric
  FROM public.timeslips t
  LEFT JOIN public.vehicles v ON v.id = t.vehicle_id
  LEFT JOIN public.profiles p ON p.id = t.driver_id
  WHERE t.date = p_date;
END $$;
REVOKE ALL ON FUNCTION public.fleet_route_day(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fleet_route_day(date) TO authenticated;

SELECT cron.schedule('fleet-position-record', '*/2 4-22 * * *', $$
  SELECT net.http_post(
    url := 'https://axigtrmaxhetyfzjjdve.supabase.co/functions/v1/radius-positions',
    headers := jsonb_build_object('Content-Type','application/json','X-Cron-Secret', public.get_cron_secret()),
    body := '{"action":"record"}'::jsonb);
$$);
SELECT cron.schedule('fleet-position-purge', '30 3 * * *', $$
  DELETE FROM public.fleet_position_history WHERE recorded_at < now() - interval '90 days';
$$);