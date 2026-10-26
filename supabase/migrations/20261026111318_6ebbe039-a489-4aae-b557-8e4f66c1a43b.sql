ALTER TABLE public.saved_route_assignments ALTER COLUMN vehicle_id DROP NOT NULL;
ALTER TABLE public.saved_route_assignments ADD COLUMN IF NOT EXISTS registration text;
UPDATE public.saved_route_assignments a SET registration = upper(replace(v.registration,' ','')) FROM public.vehicles v WHERE v.id = a.vehicle_id AND a.registration IS NULL;

CREATE OR REPLACE FUNCTION public.fleet_route_day(p_date date)
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
  SELECT NULL::uuid, s.id, s.name::text, s.start_time::text, s.job_data, a.vehicle_id, coalesce(av.registration, a.registration)::text, NULL::text,
    NULL::jsonb, NULL::numeric, NULL::numeric, NULL::integer
  FROM public.saved_routes s
  LEFT JOIN public.saved_route_assignments a ON a.saved_route_id = s.id AND a.route_date = p_date
  LEFT JOIN public.vehicles av ON av.id = a.vehicle_id
  WHERE s.name LIKE to_char(p_date, 'YYYY-MM-DD') || '%'
    AND NOT EXISTS (SELECT 1 FROM public.timeslips t2 WHERE t2.saved_route_id = s.id AND t2.date = p_date);
END $$;