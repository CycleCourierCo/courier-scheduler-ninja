DROP POLICY IF EXISTS "Orders UPDATE for users and availability" ON public.orders;

CREATE POLICY "Orders UPDATE for users and availability"
ON public.orders
FOR UPDATE
USING (
  (get_user_role(auth.uid()) = 'admin'::user_role)
  OR (auth.uid() = user_id)
  OR (auth.uid() IS NOT NULL)
  OR (auth.uid() IS NULL)
)
WITH CHECK (
  (get_user_role(auth.uid()) = 'admin'::user_role)
  OR (auth.uid() = user_id)
  OR (auth.uid() IS NOT NULL)
  OR (auth.uid() IS NULL)
);