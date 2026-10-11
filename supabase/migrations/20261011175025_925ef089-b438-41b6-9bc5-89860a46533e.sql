CREATE OR REPLACE FUNCTION public.load_orders_onto_van(p_order_ids uuid[])
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids uuid[];
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role::text NOT IN ('b2b_customer','b2c_customer')
  ) THEN
    RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501';
  END IF;
  IF p_order_ids IS NULL OR array_length(p_order_ids, 1) IS NULL THEN
    RETURN ARRAY[]::uuid[];
  END IF;
  IF array_length(p_order_ids, 1) > 500 THEN
    RAISE EXCEPTION 'Too many orders (max 500)';
  END IF;
  WITH u AS (
    UPDATE public.orders
       SET loaded_onto_van = true,
           loaded_onto_van_at = now(),
           held_by_driver_name = NULL,
           held_by_driver_at = NULL,
           storage_locations = NULL,
           updated_at = now()
     WHERE id = ANY(p_order_ids)
       AND status NOT IN ('cancelled','delivered')
    RETURNING id
  )
  SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) INTO v_ids FROM u;
  RETURN v_ids;
END;
$$;
REVOKE ALL ON FUNCTION public.load_orders_onto_van(uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.load_orders_onto_van(uuid[]) TO authenticated, service_role;