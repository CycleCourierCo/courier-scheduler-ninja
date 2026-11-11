CREATE OR REPLACE FUNCTION public.get_booking_account_names(p_user_ids uuid[])
RETURNS TABLE(id uuid, display_name text, email text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v uuid := auth.uid();
BEGIN
  IF v IS NULL OR NOT (
    has_role(v,'admin') OR has_role(v,'mechanic') OR has_role(v,'cs_agent')
    OR has_role(v,'sales') OR has_role(v,'route_planner')
  ) THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT p.id, COALESCE(NULLIF(p.company_name,''), NULLIF(p.name,''), p.email)::text, p.email::text
    FROM profiles p WHERE p.id = ANY(p_user_ids);
END $$;
REVOKE EXECUTE ON FUNCTION public.get_booking_account_names(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_booking_account_names(uuid[]) TO authenticated;