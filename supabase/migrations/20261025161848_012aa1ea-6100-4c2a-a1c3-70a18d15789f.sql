CREATE TABLE public.vehicle_odometer_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  reading_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'Europe/London')::date),
  odometer_mi integer NOT NULL,
  note text,
  recorded_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vehicle_odometer_readings_vehicle_idx ON public.vehicle_odometer_readings(vehicle_id, reading_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_odometer_readings TO authenticated;
GRANT ALL ON public.vehicle_odometer_readings TO service_role;
ALTER TABLE public.vehicle_odometer_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Fleet staff manage odometer readings" ON public.vehicle_odometer_readings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.is_fleet_staff(s.uid)))
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.is_fleet_staff(s.uid)));