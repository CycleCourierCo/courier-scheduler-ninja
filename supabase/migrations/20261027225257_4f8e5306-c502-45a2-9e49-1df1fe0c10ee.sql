CREATE OR REPLACE FUNCTION public.fleet_route_day(p_date date)
 RETURNS TABLE(timeslip_id uuid, saved_route_id uuid, route_name text, start_time text, planned_stops jsonb, vehicle_id uuid, registration text, driver_name text, job_locations jsonb, mileage numeric, total_hours numeric, total_stops integer)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
  WHERE (s.name LIKE to_char(p_date, 'YYYY-MM-DD') || '%' OR a.id IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.timeslips t2 WHERE t2.saved_route_id = s.id AND t2.date = p_date);
END $function$;

INSERT INTO public.saved_route_assignments (saved_route_id, route_date)
SELECT id, '2026-10-28'::date FROM public.saved_routes
WHERE id IN ('a18e5377-bf42-4212-a247-b4288e885b24','71a67821-dec6-4f03-9116-0b35bd52ec5b','4bedbafc-8e1c-490f-9d04-ddb0f6b5bb78','888e8ebe-b781-448c-ad55-557aa9d7cd29','f85e688e-1a40-44d2-9c16-1590a260c56b','106e2a6d-8681-4131-9f6e-17ff4d8672ce','135c391b-22b6-4c3b-b8d5-22873fcfa60e')
ON CONFLICT (saved_route_id, route_date) DO NOTHING;