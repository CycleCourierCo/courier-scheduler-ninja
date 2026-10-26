CREATE TABLE public.label_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text,
  action text NOT NULL,
  detail text,
  lat double precision,
  lon double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX label_scans_order_idx ON public.label_scans(order_id, created_at DESC);
GRANT SELECT ON public.label_scans TO authenticated;
GRANT ALL ON public.label_scans TO service_role;
ALTER TABLE public.label_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read label scans" ON public.label_scans FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles ur, (SELECT auth.uid() AS uid) me
  WHERE ur.user_id = me.uid AND ur.role::text NOT IN ('b2b_customer','b2c_customer')));

CREATE OR REPLACE FUNCTION public._label_staff_role(_uid uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ur.role::text FROM public.user_roles ur
  WHERE ur.user_id = _uid AND ur.role::text NOT IN ('b2b_customer','b2c_customer')
  ORDER BY CASE ur.role::text WHEN 'admin' THEN 0 WHEN 'cs_agent' THEN 1 WHEN 'loader' THEN 2 WHEN 'mechanic' THEN 3 WHEN 'driver' THEN 4 ELSE 5 END
  LIMIT 1 $$;
REVOKE ALL ON FUNCTION public._label_staff_role(uuid) FROM public, anon, authenticated;

-- Staff bike card for a scanned label; logs a "viewed" scan.
CREATE OR REPLACE FUNCTION public.label_lookup(p_ref text, p_lat double precision DEFAULT NULL, p_lon double precision DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_roles text[];
  o public.orders;
  v_today date := (now() AT TIME ZONE 'Europe/London')::date;
BEGIN
  v_role := public._label_staff_role(v_uid);
  IF v_uid IS NULL OR v_role IS NULL THEN RETURN NULL; END IF;
  SELECT array_agg(role::text) INTO v_roles FROM public.user_roles WHERE user_id = v_uid;
  SELECT * INTO o FROM public.orders WHERE tracking_number = trim(p_ref) OR id::text = trim(p_ref) LIMIT 1;
  IF o.id IS NULL THEN RETURN jsonb_build_object('found', false, 'roles', to_jsonb(v_roles)); END IF;
  INSERT INTO public.label_scans(order_id, user_id, role, action, lat, lon) VALUES (o.id, v_uid, v_role, 'viewed', p_lat, p_lon);
  RETURN jsonb_build_object(
    'found', true, 'roles', to_jsonb(v_roles),
    'order', jsonb_build_object(
      'id', o.id, 'tracking_number', o.tracking_number, 'status', o.status,
      'sender', jsonb_build_object('name', o.sender->>'name', 'postcode', o.sender->'address'->>'zipCode'),
      'receiver', jsonb_build_object('name', o.receiver->>'name', 'postcode', o.receiver->'address'->>'zipCode'),
      'bikes', o.bikes, 'bike_brand', o.bike_brand, 'bike_model', o.bike_model,
      'storage_locations', o.storage_locations, 'loaded_onto_van', o.loaded_onto_van,
      'collected', o.order_collected, 'delivered', o.order_delivered),
    'inspection', (SELECT jsonb_build_object('id', bi.id, 'status', bi.status) FROM public.bicycle_inspections bi WHERE bi.order_id = o.id ORDER BY bi.created_at DESC LIMIT 1),
    'routes_today', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'assignment_id', a.id, 'route', r.name, 'registration', a.registration, 'started', a.started_at IS NOT NULL,
        'mine', a.driver_id = v_uid,
        'stop_types', (SELECT jsonb_agg(DISTINCT s->>'type') FROM jsonb_array_elements(r.job_data) s WHERE s->>'orderId' = o.id::text)))
      FROM public.saved_route_assignments a JOIN public.saved_routes r ON r.id = a.saved_route_id
      WHERE a.route_date = v_today AND EXISTS (SELECT 1 FROM jsonb_array_elements(r.job_data) s WHERE s->>'orderId' = o.id::text)), '[]'::jsonb),
    'my_registration_today', (SELECT a.registration FROM public.saved_route_assignments a WHERE a.driver_id = v_uid AND a.route_date = v_today LIMIT 1),
    'recent_scans', COALESCE((SELECT jsonb_agg(x) FROM (SELECT ls.action, ls.detail, ls.role, ls.created_at, p.name AS by_name
        FROM public.label_scans ls LEFT JOIN public.profiles p ON p.id = ls.user_id
        WHERE ls.order_id = o.id AND ls.action <> 'viewed' ORDER BY ls.created_at DESC LIMIT 10) x), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.label_lookup(text, double precision, double precision) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.label_lookup(text, double precision, double precision) TO authenticated;

-- Loader actions from a scan: put in bay, load onto van, unload to depot.
CREATE OR REPLACE FUNCTION public.label_scan_action(p_order_id uuid, p_action text, p_detail text DEFAULT NULL, p_lat double precision DEFAULT NULL, p_lon double precision DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_role text; v_n int;
BEGIN
  v_role := public._label_staff_role(v_uid);
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_uid AND role::text IN ('admin','loader','route_planner','driver')) THEN
    RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501';
  END IF;
  IF p_action = 'load_van' THEN
    UPDATE public.orders SET loaded_onto_van = true, loaded_onto_van_at = now(), held_by_driver_name = NULL, held_by_driver_at = NULL, storage_locations = NULL, updated_at = now()
     WHERE id = p_order_id AND status NOT IN ('cancelled','delivered');
  ELSIF p_action = 'unload' THEN
    UPDATE public.orders SET loaded_onto_van = false, loaded_onto_van_at = NULL, updated_at = now() WHERE id = p_order_id;
  ELSIF p_action = 'bay' THEN
    IF p_detail IS NULL OR length(p_detail) > 40 THEN RAISE EXCEPTION 'Bay required'; END IF;
    UPDATE public.orders SET storage_locations = COALESCE(CASE WHEN jsonb_typeof(storage_locations) = 'array' THEN storage_locations END, '[]'::jsonb)
        || jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'orderId', id, 'bay', split_part(p_detail, '-', 1),
             'position', NULLIF(split_part(p_detail, '-', 2), '')::int, 'bikeIndex', 0, 'allocatedAt', now(), 'customerName', sender->>'name')),
        loaded_onto_van = false, held_by_driver_name = NULL, held_by_driver_at = NULL, updated_at = now()
     WHERE id = p_order_id AND status NOT IN ('cancelled','delivered');
  ELSE RAISE EXCEPTION 'Unknown action';
  END IF;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN RETURN false; END IF;
  INSERT INTO public.label_scans(order_id, user_id, role, action, detail, lat, lon) VALUES (p_order_id, v_uid, v_role, p_action, p_detail, p_lat, p_lon);
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.label_scan_action(uuid, text, text, double precision, double precision) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.label_scan_action(uuid, text, text, double precision, double precision) TO authenticated;