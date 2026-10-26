ALTER TABLE public.saved_route_assignments ADD COLUMN IF NOT EXISTS driver_id uuid, ADD COLUMN IF NOT EXISTS started_at timestamptz;
CREATE INDEX IF NOT EXISTS saved_route_assignments_driver_date_idx ON public.saved_route_assignments(driver_id, route_date);

CREATE POLICY "route planners manage route assignments" ON public.saved_route_assignments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid,'admin'::user_role) OR has_role(s.uid,'route_planner'::user_role)))
  WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid,'admin'::user_role) OR has_role(s.uid,'route_planner'::user_role)));

-- Driver's day comes from the route assignment, not timeslips. Stops hidden until started at depot.
CREATE OR REPLACE FUNCTION public.driver_today_stops(p_date date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE a record; v_stops jsonb; v_loading jsonb;
BEGIN
  SELECT sa.*, r.name AS route_name, r.job_data INTO a
    FROM saved_route_assignments sa JOIN saved_routes r ON r.id = sa.saved_route_id
   WHERE sa.driver_id = auth.uid() AND sa.route_date = p_date
   ORDER BY sa.updated_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN '{}'::jsonb; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'order_id', o.id, 'tracking_number', o.tracking_number,
      'receiver_name', o.receiver->>'name', 'bike_brand', o.bike_brand, 'bike_model', o.bike_model,
      'bike_quantity', COALESCE(o.bike_quantity,1), 'storage_locations', COALESCE(o.storage_locations,'[]'::jsonb),
      'collected', COALESCE(o.order_collected,false),
      'collected_on_this_route', EXISTS (SELECT 1 FROM jsonb_array_elements(a.job_data) p WHERE p->>'orderId' = o.id::text AND p->>'type'='pickup'),
      'from_van', (SELECT COALESCE(o2.registration, v.registration) FROM saved_route_assignments o2
                     JOIN saved_routes r2 ON r2.id = o2.saved_route_id LEFT JOIN vehicles v ON v.id = o2.vehicle_id
                    WHERE o2.route_date = p_date AND o2.id <> a.id
                      AND EXISTS (SELECT 1 FROM jsonb_array_elements(r2.job_data) p WHERE p->>'orderId' = o.id::text AND p->>'type'='pickup')
                    LIMIT 1)
    ) ORDER BY o.tracking_number), '[]'::jsonb)
  INTO v_loading
  FROM orders o
  WHERE o.id::text IN (SELECT s->>'orderId' FROM jsonb_array_elements(a.job_data) s WHERE s->>'type'='delivery');

  RETURN jsonb_build_object(
    'assignment_id', a.id, 'route_name', a.route_name,
    'registration', COALESCE(a.registration, (SELECT registration FROM vehicles WHERE id = a.vehicle_id)),
    'started_at', a.started_at,
    'stop_count', (SELECT count(*) FROM jsonb_array_elements(a.job_data) s WHERE s->>'type' IN ('pickup','delivery')),
    'stops', CASE WHEN a.started_at IS NULL THEN '[]'::jsonb ELSE a.job_data END,
    'loading', v_loading);
END $$;
REVOKE ALL ON FUNCTION public.driver_today_stops(date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.driver_today_stops(date) TO authenticated;

CREATE OR REPLACE FUNCTION public.driver_start_route(p_assignment_id uuid)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v timestamptz;
BEGIN
  UPDATE saved_route_assignments SET started_at = COALESCE(started_at, now())
   WHERE id = p_assignment_id AND driver_id = auth.uid() RETURNING started_at INTO v;
  IF v IS NULL THEN RAISE EXCEPTION 'Route not assigned to you'; END IF;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.driver_start_route(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.driver_start_route(uuid) TO authenticated;