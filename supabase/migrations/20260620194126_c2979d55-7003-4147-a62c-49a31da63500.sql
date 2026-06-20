CREATE POLICY "Internal staff can read driver/loader profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.is_internal_staff(auth.uid())
  AND role IN ('driver'::user_role, 'loader'::user_role)
);