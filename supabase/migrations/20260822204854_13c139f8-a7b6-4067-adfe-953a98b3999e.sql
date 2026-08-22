CREATE TABLE public.customer_shopify_skus (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  store_id UUID NULL REFERENCES public.customer_shopify_stores(id) ON DELETE SET NULL,
  sku CITEXT NOT NULL,
  bike_type TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT customer_shopify_skus_user_sku_unique UNIQUE (user_id, sku)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_shopify_skus TO authenticated;
GRANT ALL ON public.customer_shopify_skus TO service_role;

ALTER TABLE public.customer_shopify_skus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own shopify skus"
ON public.customer_shopify_skus FOR ALL TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Admins manage all shopify skus"
ON public.customer_shopify_skus FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u WHERE public.has_role(u.uid, 'admin'::user_role)))
WITH CHECK (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) u WHERE public.has_role(u.uid, 'admin'::user_role)));

CREATE INDEX customer_shopify_skus_user_idx ON public.customer_shopify_skus (user_id);

CREATE TRIGGER update_customer_shopify_skus_updated_at
BEFORE UPDATE ON public.customer_shopify_skus
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();