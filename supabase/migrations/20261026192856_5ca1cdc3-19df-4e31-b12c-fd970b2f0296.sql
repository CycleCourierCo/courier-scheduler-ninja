CREATE TABLE public.fleet_service_interval_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type public.vehicle_service_type NOT NULL,
  position public.vehicle_service_position,
  custom_name text,
  interval_miles integer,
  interval_months integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX fleet_service_interval_defaults_key ON public.fleet_service_interval_defaults (service_type, position, custom_name) NULLS NOT DISTINCT;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fleet_service_interval_defaults TO authenticated;
GRANT ALL ON public.fleet_service_interval_defaults TO service_role;
ALTER TABLE public.fleet_service_interval_defaults ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Fleet staff manage default intervals" ON public.fleet_service_interval_defaults FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.is_fleet_staff(s.uid)))
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.is_fleet_staff(s.uid)));

CREATE OR REPLACE FUNCTION public.fleet_bulk_log_service(p_items jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it jsonb; n integer := 0; v_mi integer;
BEGIN
  IF NOT public.is_fleet_staff(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_mi := nullif(it->>'odometer_mi','')::integer;
    INSERT INTO public.vehicle_maintenance_logs (vehicle_id, service_type, custom_name, position, service_date, odometer_mi, cost, vendor, notes, brand, model, created_by)
    VALUES ((it->>'vehicle_id')::uuid, (it->>'service_type')::public.vehicle_service_type, nullif(it->>'custom_name',''),
      nullif(it->>'position','')::public.vehicle_service_position, (it->>'service_date')::date, v_mi,
      nullif(it->>'cost','')::numeric, nullif(it->>'vendor',''), nullif(it->>'notes',''), nullif(it->>'brand',''), nullif(it->>'model',''), auth.uid());
    IF v_mi IS NOT NULL THEN
      INSERT INTO public.vehicle_odometer_readings (vehicle_id, reading_date, odometer_mi, note)
      VALUES ((it->>'vehicle_id')::uuid, (it->>'service_date')::date, v_mi, 'From service record');
    END IF;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.fleet_bulk_log_service(jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fleet_bulk_log_service(jsonb) TO authenticated;