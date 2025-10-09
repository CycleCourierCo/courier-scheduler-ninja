-- Allow loaders to update loading-related fields on orders
CREATE POLICY "Loaders can update loading fields"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  get_user_role(auth.uid()) = 'loader'
)
WITH CHECK (
  get_user_role(auth.uid()) = 'loader'
);