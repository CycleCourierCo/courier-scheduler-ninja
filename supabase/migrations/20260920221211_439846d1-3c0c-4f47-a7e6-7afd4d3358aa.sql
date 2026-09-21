
DROP POLICY IF EXISTS orders_authenticated_select_policy ON public.orders;

CREATE POLICY orders_authenticated_select_policy
ON public.orders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM (SELECT auth.uid() AS uid) s
    WHERE has_role(s.uid, 'admin'::user_role)
       OR has_role(s.uid, 'route_planner'::user_role)
       OR has_role(s.uid, 'loader'::user_role)
       OR has_role(s.uid, 'mechanic'::user_role)
       OR has_role(s.uid, 'cs_agent'::user_role)
       OR orders.user_id = s.uid
  )
);

CREATE OR REPLACE FUNCTION public.cs_update_order_bikes(p_order_id uuid, p_bikes jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_first jsonb;
  v_count integer;
  v_old jsonb;
  v_actor_name text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  IF NOT (has_role(v_uid, 'admin'::user_role) OR has_role(v_uid, 'cs_agent'::user_role)) THEN
    RAISE EXCEPTION 'Not permitted to edit bikes';
  END IF;

  IF p_bikes IS NULL OR jsonb_typeof(p_bikes) <> 'array' OR jsonb_array_length(p_bikes) = 0 THEN
    RAISE EXCEPTION 'At least one bike is required';
  END IF;

  v_count := jsonb_array_length(p_bikes);
  IF v_count > 8 THEN
    RAISE EXCEPTION 'A maximum of 8 bikes is allowed';
  END IF;

  SELECT bikes INTO v_old FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  v_first := p_bikes -> 0;

  UPDATE public.orders
     SET bikes = p_bikes,
         bike_brand = NULLIF(btrim(COALESCE(v_first ->> 'brand', '')), ''),
         bike_model = NULLIF(btrim(COALESCE(v_first ->> 'model', '')), ''),
         bike_quantity = v_count,
         updated_at = now()
   WHERE id = p_order_id;

  SELECT COALESCE(NULLIF(btrim(COALESCE(p.name, '')), ''), p.email, 'Staff')
    INTO v_actor_name
    FROM public.profiles p
   WHERE p.id = v_uid;

  INSERT INTO public.order_comments (order_id, admin_id, admin_name, comment)
  VALUES (
    p_order_id,
    v_uid,
    COALESCE(v_actor_name, 'Staff'),
    'Bike details updated (' || v_count || ' bike(s)). Previous: ' || COALESCE(v_old::text, 'none')
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.cs_update_order_bikes(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cs_update_order_bikes(uuid, jsonb) TO authenticated;
