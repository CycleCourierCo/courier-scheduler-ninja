ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS ni_partner_label_url text,
  ADD COLUMN IF NOT EXISTS ni_partner_label_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS ni_bfs_number text,
  ADD COLUMN IF NOT EXISTS ni_bfs_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS ni_inbound_status text,
  ADD COLUMN IF NOT EXISTS ni_inbound_collected_at timestamptz,
  ADD COLUMN IF NOT EXISTS ni_inbound_ferry_crossed_at timestamptz,
  ADD COLUMN IF NOT EXISTS ni_inbound_received_at timestamptz,
  ADD COLUMN IF NOT EXISTS foam_crossed_to_ni_at timestamptz;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_ni_inbound_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_ni_inbound_status_check
  CHECK (ni_inbound_status IS NULL OR ni_inbound_status IN (
    'awaiting_ni_collection',
    'collected_in_ni',
    'crossed_ferry',
    'collected_from_partner'
  ));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'foam_status' AND e.enumlabel = 'crossed_to_ni'
  ) THEN
    ALTER TYPE public.foam_status ADD VALUE 'crossed_to_ni' AFTER 'delivered_to_ferry';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.get_ni_partner_job(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders;
  v_direction text;
  v_party jsonb;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF COALESCE(v_order.is_northern_ireland, false) IS NOT TRUE THEN
    RETURN NULL;
  END IF;

  v_direction := COALESCE(v_order.ni_direction, 'outbound');
  v_party := CASE WHEN v_direction = 'inbound' THEN v_order.sender ELSE v_order.receiver END;

  RETURN jsonb_build_object(
    'id', v_order.id,
    'tracking_number', v_order.tracking_number,
    'direction', v_direction,
    'bike_brand', v_order.bike_brand,
    'bike_model', v_order.bike_model,
    'bike_quantity', v_order.bike_quantity,
    'party', jsonb_build_object(
      'name', v_party->>'name',
      'phone', v_party->>'phone',
      'address', v_party->'address'
    ),
    'bfs_number', v_order.ni_bfs_number,
    'label_url', v_order.ni_partner_label_url,
    'label_uploaded_at', v_order.ni_partner_label_uploaded_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_ni_partner_details(
  p_order_id uuid,
  p_bfs_number text DEFAULT NULL,
  p_label_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_ni boolean;
  v_bfs text;
BEGIN
  SELECT COALESCE(is_northern_ireland, false) INTO v_is_ni
  FROM public.orders WHERE id = p_order_id;

  IF v_is_ni IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;
  IF v_is_ni IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not a Northern Ireland order');
  END IF;

  v_bfs := NULLIF(btrim(COALESCE(p_bfs_number, '')), '');
  IF v_bfs IS NOT NULL AND length(v_bfs) > 64 THEN
    RETURN jsonb_build_object('success', false, 'error', 'BFS number is too long');
  END IF;

  UPDATE public.orders
  SET
    ni_bfs_number = COALESCE(v_bfs, ni_bfs_number),
    ni_bfs_updated_at = CASE WHEN v_bfs IS NOT NULL THEN now() ELSE ni_bfs_updated_at END,
    ni_partner_label_url = COALESCE(NULLIF(btrim(COALESCE(p_label_url, '')), ''), ni_partner_label_url),
    ni_partner_label_uploaded_at = CASE
      WHEN NULLIF(btrim(COALESCE(p_label_url, '')), '') IS NOT NULL THEN now()
      ELSE ni_partner_label_uploaded_at END,
    updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ni_partner_job(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_ni_partner_details(uuid, text, text) TO anon, authenticated;