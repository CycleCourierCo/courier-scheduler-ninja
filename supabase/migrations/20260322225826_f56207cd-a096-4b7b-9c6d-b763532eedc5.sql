CREATE POLICY "orders_authenticated_public_select_policy"
ON public.orders
FOR SELECT
TO authenticated
USING (tracking_number IS NOT NULL);