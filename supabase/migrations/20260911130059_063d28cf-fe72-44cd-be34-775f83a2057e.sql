ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS returned_to_seller_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS returned_from_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS orders_returned_from_order_id_idx
  ON public.orders (returned_from_order_id)
  WHERE returned_from_order_id IS NOT NULL;