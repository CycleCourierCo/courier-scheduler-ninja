CREATE OR REPLACE FUNCTION public.trg_notify_ferry_partner_on_pickup_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_should boolean := false;
  v_has_pickup boolean;
BEGIN
  IF NOT COALESCE(NEW.is_northern_ireland, false) THEN
    RETURN NEW;
  END IF;
  IF NEW.ferry_partner_notified_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_has_pickup := NEW.pickup_date IS NOT NULL
    AND jsonb_typeof(to_jsonb(NEW.pickup_date)) = 'array'
    AND jsonb_array_length(to_jsonb(NEW.pickup_date)) > 0;

  IF TG_OP = 'INSERT' THEN
    v_should := (NEW.ni_direction = 'outbound')
             OR (NEW.ni_direction = 'inbound' AND v_has_pickup);
  ELSE
    IF NEW.ni_direction = 'outbound' THEN
      v_should := COALESCE(OLD.is_northern_ireland, false) IS DISTINCT FROM true
               OR OLD.ni_direction IS DISTINCT FROM NEW.ni_direction;
    ELSIF NEW.ni_direction = 'inbound' THEN
      v_should := v_has_pickup
               AND (OLD.pickup_date IS DISTINCT FROM NEW.pickup_date
                    OR COALESCE(OLD.is_northern_ireland, false) IS DISTINCT FROM true
                    OR OLD.ni_direction IS DISTINCT FROM NEW.ni_direction);
    END IF;
  END IF;

  IF v_should THEN
    BEGIN
      PERFORM public.invoke_ferry_partner_notification(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Ferry partner notification dispatch failed: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_ferry_partner_on_pickup_date ON public.orders;
CREATE TRIGGER notify_ferry_partner_on_pickup_date
AFTER INSERT OR UPDATE OF pickup_date, is_northern_ireland, ni_direction ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.trg_notify_ferry_partner_on_pickup_date();