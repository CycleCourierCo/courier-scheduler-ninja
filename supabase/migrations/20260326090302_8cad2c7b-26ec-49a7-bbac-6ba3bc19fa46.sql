CREATE POLICY "warehouse_stock_owner_update" ON public.warehouse_stock
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));