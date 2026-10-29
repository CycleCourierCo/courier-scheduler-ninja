ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS ferry_region text;
UPDATE public.orders SET ferry_region = 'northern_ireland' WHERE is_northern_ireland = true AND ferry_region IS NULL;
CREATE OR REPLACE FUNCTION public.orders_validate_ferry_region()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.ferry_region IS NOT NULL AND NEW.ferry_region NOT IN ('northern_ireland','isle_of_man') THEN
    RAISE EXCEPTION 'Invalid ferry_region %', NEW.ferry_region;
  END IF;
  IF NEW.is_northern_ireland AND NEW.ferry_region IS NULL THEN
    NEW.ferry_region := 'northern_ireland';
  ELSIF NOT NEW.is_northern_ireland THEN
    NEW.ferry_region := NULL;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.orders_validate_ferry_region() FROM PUBLIC, anon;
DROP TRIGGER IF EXISTS orders_validate_ferry_region ON public.orders;
CREATE TRIGGER orders_validate_ferry_region BEFORE INSERT OR UPDATE OF ferry_region, is_northern_ireland ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.orders_validate_ferry_region();