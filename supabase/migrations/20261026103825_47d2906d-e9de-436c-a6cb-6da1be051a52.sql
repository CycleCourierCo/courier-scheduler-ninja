CREATE TABLE public.saved_route_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  saved_route_id uuid NOT NULL REFERENCES public.saved_routes(id) ON DELETE CASCADE,
  route_date date NOT NULL,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  assigned_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (saved_route_id, route_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_route_assignments TO authenticated;
GRANT ALL ON public.saved_route_assignments TO service_role;
ALTER TABLE public.saved_route_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fleet staff manage route assignments" ON public.saved_route_assignments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.is_fleet_staff(s.uid)))
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE public.is_fleet_staff(s.uid)));

-- Assignment -> link the van's timeslip(s) for that date; unlink a previous van on reassign.
CREATE OR REPLACE FUNCTION public.apply_saved_route_assignment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'UPDATE' AND OLD.vehicle_id IS DISTINCT FROM NEW.vehicle_id THEN
    UPDATE public.timeslips SET saved_route_id = NULL
     WHERE saved_route_id = OLD.saved_route_id AND date = OLD.route_date AND vehicle_id = OLD.vehicle_id;
  END IF;
  UPDATE public.timeslips SET saved_route_id = NEW.saved_route_id
   WHERE vehicle_id = NEW.vehicle_id AND date = NEW.route_date
     AND saved_route_id IS DISTINCT FROM NEW.saved_route_id;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.apply_saved_route_assignment() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER saved_route_assignment_apply BEFORE INSERT OR UPDATE ON public.saved_route_assignments
  FOR EACH ROW EXECUTE FUNCTION public.apply_saved_route_assignment();

-- New/changed timeslip with no route picks up the van's assignment (runs before the freeze trigger).
CREATE OR REPLACE FUNCTION public.timeslip_apply_route_assignment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.saved_route_id IS NULL AND NEW.vehicle_id IS NOT NULL THEN
    SELECT a.saved_route_id INTO NEW.saved_route_id FROM public.saved_route_assignments a
     WHERE a.vehicle_id = NEW.vehicle_id AND a.route_date = NEW.date
     ORDER BY a.updated_at DESC LIMIT 1;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.timeslip_apply_route_assignment() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER timeslip_apply_route_assignment BEFORE INSERT OR UPDATE OF vehicle_id, date ON public.timeslips
  FOR EACH ROW EXECUTE FUNCTION public.timeslip_apply_route_assignment();

ALTER TABLE public.fleet_eta_links
  ADD COLUMN IF NOT EXISTS saved_route_id uuid,
  ADD COLUMN IF NOT EXISTS route_date date,
  ADD COLUMN IF NOT EXISTS stop_index integer;

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
  SELECT NULL::uuid, s.id, s.name::text, s.start_time::text, s.job_data, a.vehicle_id, av.registration::text, NULL::text,
    NULL::jsonb, NULL::numeric, NULL::numeric, NULL::integer
  FROM public.saved_routes s
  LEFT JOIN public.saved_route_assignments a ON a.saved_route_id = s.id AND a.route_date = p_date
  LEFT JOIN public.vehicles av ON av.id = a.vehicle_id
  WHERE s.name LIKE to_char(p_date, 'YYYY-MM-DD') || '%'
    AND NOT EXISTS (SELECT 1 FROM public.timeslips t2 WHERE t2.saved_route_id = s.id AND t2.date = p_date);
END $$;
REVOKE ALL ON FUNCTION public.fleet_route_day(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fleet_route_day(date) TO authenticated;