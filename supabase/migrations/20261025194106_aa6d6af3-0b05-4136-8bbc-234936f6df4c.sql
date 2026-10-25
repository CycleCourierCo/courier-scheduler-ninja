ALTER TABLE public.timeslips
  ADD COLUMN IF NOT EXISTS saved_route_id uuid REFERENCES public.saved_routes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS planned_snapshot jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS timeslips_saved_route_unique ON public.timeslips(saved_route_id) WHERE saved_route_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.timeslip_freeze_planned_route()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.saved_route_id IS NULL THEN
    NEW.planned_snapshot := NULL;
  ELSIF TG_OP = 'INSERT' OR NEW.saved_route_id IS DISTINCT FROM OLD.saved_route_id THEN
    SELECT jsonb_build_object('name', s.name, 'start_time', s.start_time, 'stops', s.job_data, 'linked_at', now())
      INTO NEW.planned_snapshot FROM public.saved_routes s WHERE s.id = NEW.saved_route_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS timeslip_freeze_planned_route ON public.timeslips;
CREATE TRIGGER timeslip_freeze_planned_route BEFORE INSERT OR UPDATE OF saved_route_id ON public.timeslips
  FOR EACH ROW EXECUTE FUNCTION public.timeslip_freeze_planned_route();

DROP FUNCTION IF EXISTS public.fleet_route_day(date);
CREATE FUNCTION public.fleet_route_day(p_date date)
RETURNS TABLE(timeslip_id uuid, saved_route_id uuid, route_name text, start_time text, planned_stops jsonb,
  vehicle_id uuid, registration text, driver_name text, job_locations jsonb, mileage numeric, total_hours numeric, total_stops integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_fleet_staff(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT t.id, t.saved_route_id, coalesce(t.planned_snapshot->>'name', s.name)::text,
    coalesce(t.planned_snapshot->>'start_time', s.start_time)::text,
    coalesce(t.planned_snapshot->'stops', s.job_data),
    t.vehicle_id, v.registration::text, p.name::text, to_jsonb(t.job_locations), t.mileage::numeric,
    t.total_hours::numeric, t.total_stops::integer
  FROM public.timeslips t
  LEFT JOIN public.saved_routes s ON s.id = t.saved_route_id
  LEFT JOIN public.vehicles v ON v.id = t.vehicle_id
  LEFT JOIN public.profiles p ON p.id = t.driver_id
  WHERE t.date = p_date
  UNION ALL
  SELECT NULL::uuid, s.id, s.name::text, s.start_time::text, s.job_data, NULL::uuid, NULL::text, NULL::text,
    NULL::jsonb, NULL::numeric, NULL::numeric, NULL::integer
  FROM public.saved_routes s
  WHERE s.name LIKE to_char(p_date, 'YYYY-MM-DD') || '%'
    AND NOT EXISTS (SELECT 1 FROM public.timeslips t2 WHERE t2.saved_route_id = s.id);
END $$;
REVOKE ALL ON FUNCTION public.fleet_route_day(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fleet_route_day(date) TO authenticated;