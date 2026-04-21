CREATE OR REPLACE FUNCTION public.get_business_opening_hours(user_ids uuid[])
RETURNS TABLE (
  id uuid,
  email text,
  accounts_email text,
  opening_hours jsonb,
  is_business boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::user_role)
    OR public.has_role(auth.uid(), 'route_planner'::user_role)
    OR public.has_role(auth.uid(), 'loader'::user_role)
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.id, p.email, p.accounts_email, p.opening_hours, p.is_business
  FROM public.profiles p
  WHERE p.id = ANY(user_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_business_opening_hours(uuid[]) TO authenticated;