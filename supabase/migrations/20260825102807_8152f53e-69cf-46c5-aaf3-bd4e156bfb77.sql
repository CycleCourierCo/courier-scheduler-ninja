CREATE OR REPLACE FUNCTION public.set_claim_created_by()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL THEN
      NEW.created_by := auth.uid();
    END IF;
  ELSE
    NEW.created_by := OLD.created_by;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS claims_set_created_by ON public.claims;
CREATE TRIGGER claims_set_created_by
BEFORE INSERT OR UPDATE ON public.claims
FOR EACH ROW
EXECUTE FUNCTION public.set_claim_created_by();