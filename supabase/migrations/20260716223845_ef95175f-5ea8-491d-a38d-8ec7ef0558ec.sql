
-- Sync trigger: box orders' status mirrors box_my_bike_status
CREATE OR REPLACE FUNCTION public.sync_box_my_bike_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF NEW.is_box_my_bike IS TRUE THEN
    IF TG_OP = 'INSERT' AND NEW.box_my_bike_status IS NULL THEN
      NEW.box_my_bike_status := 'awaiting_depot';
    END IF;
    IF NEW.status IS DISTINCT FROM 'cancelled'::order_status
       AND NEW.box_my_bike_status IS NOT NULL THEN
      NEW.status := NEW.box_my_bike_status::order_status;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_box_my_bike_status ON public.orders;
CREATE TRIGGER trg_sync_box_my_bike_status
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_box_my_bike_status();

-- Backfill existing Box My Bike orders
UPDATE public.orders
SET status = box_my_bike_status::order_status
WHERE is_box_my_bike = true
  AND box_my_bike_status IS NOT NULL
  AND status <> 'cancelled'::order_status
  AND status::text <> box_my_bike_status;

-- Extend webhook event mapping
CREATE OR REPLACE FUNCTION public.get_webhook_event_for_status(new_status text, old_status text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $function$
BEGIN
  IF old_status = new_status THEN
    RETURN NULL;
  END IF;

  CASE new_status
    WHEN 'created' THEN
      RETURN 'order.created';
    WHEN 'cancelled' THEN
      RETURN 'order.cancelled';
    WHEN 'driver_to_collection' THEN
      RETURN 'order.collection.started';
    WHEN 'collected' THEN
      RETURN 'order.collection.completed';
    WHEN 'driver_to_delivery' THEN
      RETURN 'order.delivery.started';
    WHEN 'delivered' THEN
      RETURN 'order.delivery.completed';
    WHEN 'awaiting_depot' THEN
      RETURN 'order.box.awaiting_depot';
    WHEN 'in_depot_awaiting_boxing' THEN
      RETURN 'order.box.in_depot';
    WHEN 'boxed_awaiting_label' THEN
      RETURN 'order.box.boxed';
    WHEN 'awaiting_3p_collection' THEN
      RETURN 'order.box.awaiting_3p';
    WHEN 'collected_by_3p' THEN
      RETURN 'order.box.collected_by_3p';
    ELSE
      RETURN 'order.status.updated';
  END CASE;
END;
$function$;
