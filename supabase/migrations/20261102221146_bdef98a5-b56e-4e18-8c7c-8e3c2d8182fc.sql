CREATE OR REPLACE FUNCTION public.box_my_bike_advance_on_collection()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.is_box_my_bike IS TRUE
     AND NEW.order_collected IS TRUE
     AND COALESCE(OLD.order_collected, false) IS FALSE
     AND (NEW.box_my_bike_status IS NULL OR NEW.box_my_bike_status::text = 'awaiting_depot') THEN
    NEW.box_my_bike_status := 'in_depot_awaiting_boxing';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.box_my_bike_advance_on_collection() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_box_my_bike_advance_on_collection ON public.orders;
CREATE TRIGGER trg_box_my_bike_advance_on_collection
BEFORE UPDATE OF order_collected ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.box_my_bike_advance_on_collection();

UPDATE public.orders SET box_my_bike_status = 'in_depot_awaiting_boxing'
WHERE is_box_my_bike = true AND order_collected = true
  AND COALESCE(order_delivered, false) = false
  AND (box_my_bike_status IS NULL OR box_my_bike_status::text = 'awaiting_depot');