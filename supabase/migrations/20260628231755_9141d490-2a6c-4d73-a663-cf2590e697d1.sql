
-- 1. Add SKU column to warehouse_stock
ALTER TABLE public.warehouse_stock
  ADD COLUMN IF NOT EXISTS sku text;
CREATE INDEX IF NOT EXISTS idx_warehouse_stock_user_sku_status
  ON public.warehouse_stock(user_id, sku, status)
  WHERE sku IS NOT NULL;

-- 2. customer_shopify_stores
CREATE TABLE IF NOT EXISTS public.customer_shopify_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  shop_domain text NOT NULL,
  access_token_vault_key text NOT NULL,
  webhook_secret_vault_key text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_domain),
  UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_shopify_stores TO authenticated;
GRANT ALL ON public.customer_shopify_stores TO service_role;

ALTER TABLE public.customer_shopify_stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers manage their own shopify store"
  ON public.customer_shopify_stores
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::user_role));

CREATE TRIGGER trg_customer_shopify_stores_updated
  BEFORE UPDATE ON public.customer_shopify_stores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. customer_shopify_order_log
CREATE TABLE IF NOT EXISTS public.customer_shopify_order_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.customer_shopify_stores(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  shop_domain text,
  shopify_order_id text,
  shopify_order_number text,
  line_item_sku text,
  status text NOT NULL,  -- matched | unmatched_sku | error | duplicate | fulfilled
  message text,
  warehouse_stock_id uuid,
  linked_order_id uuid,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_domain, shopify_order_id, line_item_sku)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_shopify_order_log TO authenticated;
GRANT ALL ON public.customer_shopify_order_log TO service_role;

ALTER TABLE public.customer_shopify_order_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers view their own shopify logs"
  ON public.customer_shopify_order_log
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::user_role));

CREATE INDEX IF NOT EXISTS idx_shopify_log_user_created
  ON public.customer_shopify_order_log(user_id, created_at DESC);
