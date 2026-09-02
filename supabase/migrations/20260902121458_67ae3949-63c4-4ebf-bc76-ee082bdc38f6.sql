CREATE OR REPLACE FUNCTION public.bike_builds_guard_customer_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  is_staff boolean;
BEGIN
  IF uid IS NULL THEN
    RETURN NEW;
  END IF;
  is_staff := has_role(uid, 'admin'::user_role) OR has_role(uid, 'loader'::user_role) OR has_role(uid, 'mechanic'::user_role);
  IF is_staff THEN
    RETURN NEW;
  END IF;
  NEW.labour_cost := OLD.labour_cost;
  NEW.invoice_number := OLD.invoice_number;
  NEW.invoice_url := OLD.invoice_url;
  NEW.invoiced_at := OLD.invoiced_at;
  NEW.linked_stock_id := OLD.linked_stock_id;
  NEW.built_at := OLD.built_at;
  NEW.user_id := OLD.user_id;
  -- Customers may only move a build between the early, pre-workshop stages.
  IF NOT (
    OLD.stage IN ('awaiting_build','awaiting_parts','picking_parts')
    AND NEW.stage IN ('awaiting_build','awaiting_parts','picking_parts')
  ) THEN
    NEW.stage := OLD.stage;
  END IF;
  RETURN NEW;
END;
$$;