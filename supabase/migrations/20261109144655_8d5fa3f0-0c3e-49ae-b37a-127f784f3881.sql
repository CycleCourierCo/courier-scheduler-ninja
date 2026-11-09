CREATE OR REPLACE FUNCTION public.timeslip_apply_route_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_route uuid;
BEGIN
  IF NEW.saved_route_id IS NULL THEN
    -- 1. The route assigned to this driver for the day
    SELECT a.saved_route_id INTO v_route
      FROM public.saved_route_assignments a
     WHERE a.driver_id = NEW.driver_id AND a.route_date = NEW.date
       AND NOT EXISTS (SELECT 1 FROM public.timeslips t
                        WHERE t.saved_route_id = a.saved_route_id AND t.id <> NEW.id)
     ORDER BY a.updated_at DESC LIMIT 1;

    -- 2. Otherwise the van's route, only if no other driver holds it
    IF v_route IS NULL AND NEW.vehicle_id IS NOT NULL THEN
      SELECT a.saved_route_id INTO v_route
        FROM public.saved_route_assignments a
       WHERE a.vehicle_id = NEW.vehicle_id AND a.route_date = NEW.date
         AND (a.driver_id IS NULL OR a.driver_id = NEW.driver_id)
         AND NOT EXISTS (SELECT 1 FROM public.timeslips t
                          WHERE t.saved_route_id = a.saved_route_id AND t.id <> NEW.id)
       ORDER BY a.updated_at DESC LIMIT 1;
    END IF;

    NEW.saved_route_id := v_route;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.apply_saved_route_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_slip uuid;
BEGIN
  NEW.updated_at := now();

  IF TG_OP = 'UPDATE' AND (OLD.vehicle_id IS DISTINCT FROM NEW.vehicle_id
                           OR OLD.driver_id IS DISTINCT FROM NEW.driver_id) THEN
    UPDATE public.timeslips SET saved_route_id = NULL
     WHERE saved_route_id = OLD.saved_route_id AND date = OLD.route_date;
  END IF;

  -- Route already on a timeslip: nothing to do
  IF EXISTS (SELECT 1 FROM public.timeslips WHERE saved_route_id = NEW.saved_route_id) THEN
    RETURN NEW;
  END IF;

  SELECT t.id INTO v_slip
    FROM public.timeslips t
   WHERE t.date = NEW.route_date
     AND (t.saved_route_id IS NULL
          OR (TG_OP = 'UPDATE' AND t.saved_route_id = OLD.saved_route_id))
     AND (
       (NEW.driver_id IS NOT NULL AND t.driver_id = NEW.driver_id)
       OR (NEW.driver_id IS NULL AND NEW.vehicle_id IS NOT NULL AND t.vehicle_id = NEW.vehicle_id)
     )
   ORDER BY t.created_at
   LIMIT 1;

  IF v_slip IS NOT NULL THEN
    UPDATE public.timeslips SET saved_route_id = NEW.saved_route_id WHERE id = v_slip;
  END IF;

  RETURN NEW;
END $function$;

REVOKE ALL ON FUNCTION public.timeslip_apply_route_assignment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_saved_route_assignment() FROM PUBLIC, anon, authenticated;