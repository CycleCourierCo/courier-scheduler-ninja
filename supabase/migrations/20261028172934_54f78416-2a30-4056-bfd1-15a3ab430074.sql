DROP POLICY IF EXISTS delivery_proofs_insert ON public.delivery_proofs;
DROP FUNCTION IF EXISTS public.driver_can_prove_order(uuid, uuid, timestamptz);
CREATE FUNCTION public.driver_can_prove_order(_order_id uuid, _captured timestamptz)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM saved_route_assignments sa JOIN saved_routes r ON r.id = sa.saved_route_id
    WHERE sa.driver_id = auth.uid()
      AND sa.route_date BETWEEN ((_captured AT TIME ZONE 'Europe/London')::date - 1)
                            AND ((_captured AT TIME ZONE 'Europe/London')::date + 1)
      AND EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(r.job_data,'[]'::jsonb)) s
                  WHERE s->>'orderId' = _order_id::text)
  );
$$;
REVOKE ALL ON FUNCTION public.driver_can_prove_order(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.driver_can_prove_order(uuid, timestamptz) TO authenticated, service_role;
CREATE POLICY delivery_proofs_insert ON public.delivery_proofs FOR INSERT TO authenticated
  WITH CHECK (
    driver_id = (SELECT auth.uid())
    AND has_role((SELECT auth.uid()), 'driver'::user_role)
    AND captured_at <= now() + interval '10 minutes'
    AND public.driver_can_prove_order(order_id, captured_at)
  );