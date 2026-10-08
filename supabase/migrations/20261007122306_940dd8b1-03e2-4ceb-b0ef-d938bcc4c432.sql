ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS guaranteed_type text NOT NULL DEFAULT 'delivery',
  ADD COLUMN IF NOT EXISTS guaranteed_collection_date date;
CREATE OR REPLACE FUNCTION public.validate_guaranteed_type() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.guaranteed_type NOT IN ('delivery','collection','both') THEN
    RAISE EXCEPTION 'Invalid guaranteed_type %', NEW.guaranteed_type;
  END IF;
  IF NEW.guaranteed_type = 'both' AND NEW.guaranteed_collection_date IS NOT NULL AND NEW.guaranteed_delivery_date IS NOT NULL
     AND NEW.guaranteed_delivery_date < NEW.guaranteed_collection_date THEN
    RAISE EXCEPTION 'Guaranteed delivery date cannot be before the guaranteed collection date';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validate_guaranteed_type ON public.orders;
CREATE TRIGGER trg_validate_guaranteed_type BEFORE INSERT OR UPDATE OF guaranteed_type, guaranteed_collection_date, guaranteed_delivery_date ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.validate_guaranteed_type();