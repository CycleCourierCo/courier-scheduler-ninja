ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'delivered_by_3p' AFTER 'collected_by_3p';

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS box_delivered_by_3p_at timestamptz;

CREATE OR REPLACE FUNCTION public.get_webhook_event_for_status(new_status text, old_status text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
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
    WHEN 'delivered_by_3p' THEN
      RETURN 'order.box.delivered_by_3p';
    ELSE
      RETURN 'order.status.updated';
  END CASE;
END;
$function$;