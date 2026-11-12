-- Cancelled orders must never accept customer dates (that previously un-cancelled them).
DO $$
DECLARE r record; def text; newdef text;
BEGIN
  FOR r IN SELECT p.oid FROM pg_proc p
           WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'set_order_availability'
             AND p.prorettype = 'jsonb'::regtype LOOP
    def := pg_get_functiondef(r.oid);
    IF position('This order has been cancelled' in def) = 0 THEN
      newdef := replace(def,
        $x$RAISE EXCEPTION 'order not found';
  END IF;$x$,
        $x$RAISE EXCEPTION 'order not found';
  END IF;

  IF v_order.status = 'cancelled' THEN
    RETURN jsonb_build_object('error', 'This order has been cancelled');
  END IF;$x$);
      IF newdef = def THEN RAISE EXCEPTION 'set_order_availability: anchor not found'; END IF;
      EXECUTE newdef;
    END IF;
  END LOOP;
END $$;