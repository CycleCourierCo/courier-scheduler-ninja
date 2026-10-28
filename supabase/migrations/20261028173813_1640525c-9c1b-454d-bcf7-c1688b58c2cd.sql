-- Wrong postcode now returns a result instead of raising, so the attempt row is kept and the 10-per-10-minutes limit really counts failed guesses.
DO $$
DECLARE r record; def text; newdef text;
BEGIN
  FOR r IN SELECT p.oid FROM pg_proc p
           WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'set_order_availability'
             AND p.prorettype = 'jsonb'::regtype LOOP
    def := pg_get_functiondef(r.oid);
    newdef := replace(def,
      $x$RAISE EXCEPTION 'Postcode does not match' USING ERRCODE = 'check_violation';$x$,
      $x$RETURN jsonb_build_object('error', 'Postcode does not match');$x$);
    IF newdef <> def THEN EXECUTE newdef; END IF;
  END LOOP;
END $$;

-- Only one return-to-seller job per original order.
CREATE UNIQUE INDEX IF NOT EXISTS orders_one_return_per_origin
  ON public.orders (returned_from_order_id) WHERE returned_from_order_id IS NOT NULL;