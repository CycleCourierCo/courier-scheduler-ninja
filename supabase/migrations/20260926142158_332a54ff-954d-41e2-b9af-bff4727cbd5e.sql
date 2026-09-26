ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_warehouse_storage boolean NOT NULL DEFAULT false;
ALTER TABLE public.warehouse_stock ADD COLUMN IF NOT EXISTS source_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS warehouse_stock_source_order_uidx ON public.warehouse_stock(source_order_id) WHERE source_order_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_stock_from_storage_order(p_order_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.orders;
  loc jsonb;
  v_id uuid;
  v_site uuid;
BEGIN
  IF NOT public.is_internal_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  SELECT * INTO o FROM public.orders WHERE id = p_order_id;
  IF o.id IS NULL OR o.is_warehouse_storage IS NOT TRUE THEN
    RETURN NULL;
  END IF;
  loc := CASE WHEN jsonb_typeof(o.storage_locations) = 'array' THEN o.storage_locations->0 ELSE o.storage_locations END;
  IF loc IS NULL OR loc->>'bay' IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT id INTO v_site FROM public.sites WHERE code = 'BHM' LIMIT 1;

  INSERT INTO public.warehouse_stock (user_id, deposited_by, item_kind, quantity, bike_brand, bike_model, bike_type, bike_value, item_notes, bay, position, site_id, status, source_order_id)
  VALUES (o.user_id, auth.uid(), 'bike', 1, o.bike_brand, o.bike_model, o.bike_type, o.bike_value,
          'Booked in for storage: ' || coalesce(o.tracking_number, o.id::text),
          upper(loc->>'bay'), (loc->>'position')::int, v_site, 'stored', o.id)
  ON CONFLICT (source_order_id) WHERE source_order_id IS NOT NULL
  DO UPDATE SET bay = EXCLUDED.bay, position = EXCLUDED.position, updated_at = now()
  RETURNING id INTO v_id;

  UPDATE public.orders SET status = 'delivered', order_delivered = true, updated_at = now()
  WHERE id = o.id AND status <> 'delivered';
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_stock_from_storage_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_stock_from_storage_order(uuid) TO authenticated;