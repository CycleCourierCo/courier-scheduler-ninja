CREATE TABLE public.delivery_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL,
  stop_type text NOT NULL DEFAULT 'delivery',
  photo_paths text[] NOT NULL DEFAULT '{}',
  signature_path text,
  recipient_name text,
  note text,
  lat double precision,
  lng double precision,
  captured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.delivery_proofs TO authenticated;
GRANT ALL ON public.delivery_proofs TO service_role;
ALTER TABLE public.delivery_proofs ENABLE ROW LEVEL SECURITY;
CREATE INDEX delivery_proofs_order_idx ON public.delivery_proofs(order_id);
CREATE POLICY delivery_proofs_insert ON public.delivery_proofs FOR INSERT TO authenticated
  WITH CHECK (driver_id = (SELECT auth.uid()) AND has_role((SELECT auth.uid()), 'driver'::user_role));
CREATE POLICY delivery_proofs_select ON public.delivery_proofs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE delivery_proofs.driver_id = s.uid
    OR has_role(s.uid,'admin'::user_role) OR has_role(s.uid,'cs_agent'::user_role) OR has_role(s.uid,'route_planner'::user_role)));

CREATE TABLE public.driver_positions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  driver_id uuid NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  accuracy double precision,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.driver_positions TO authenticated;
GRANT ALL ON public.driver_positions TO service_role;
ALTER TABLE public.driver_positions ENABLE ROW LEVEL SECURITY;
CREATE INDEX driver_positions_driver_time_idx ON public.driver_positions(driver_id, recorded_at DESC);
CREATE POLICY driver_positions_insert ON public.driver_positions FOR INSERT TO authenticated
  WITH CHECK (driver_id = (SELECT auth.uid()) AND has_role((SELECT auth.uid()), 'driver'::user_role));
CREATE POLICY driver_positions_select ON public.driver_positions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) s WHERE has_role(s.uid,'admin'::user_role) OR has_role(s.uid,'fleet_manager'::user_role)));

CREATE OR REPLACE FUNCTION public.driver_today_stops(p_date date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((
    SELECT jsonb_build_object('timeslip_id', t.id, 'route_name', r.name,
      'stops', COALESCE(t.planned_snapshot->'job_data', r.job_data))
    FROM timeslips t LEFT JOIN saved_routes r ON r.id = t.saved_route_id
    WHERE t.driver_id = auth.uid() AND t.date = p_date AND t.saved_route_id IS NOT NULL
    ORDER BY t.created_at DESC LIMIT 1), '{}'::jsonb);
$$;
REVOKE ALL ON FUNCTION public.driver_today_stops(date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.driver_today_stops(date) TO authenticated;

CREATE POLICY delivery_proof_files_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'delivery-proofs' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
CREATE POLICY delivery_proof_files_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'delivery-proofs' AND ((storage.foldername(name))[1] = (SELECT auth.uid())::text
    OR has_role((SELECT auth.uid()),'admin'::user_role) OR has_role((SELECT auth.uid()),'cs_agent'::user_role) OR has_role((SELECT auth.uid()),'route_planner'::user_role)));

SELECT cron.schedule('purge-driver-positions', '17 3 * * *', $$DELETE FROM public.driver_positions WHERE recorded_at < now() - interval '90 days'$$);