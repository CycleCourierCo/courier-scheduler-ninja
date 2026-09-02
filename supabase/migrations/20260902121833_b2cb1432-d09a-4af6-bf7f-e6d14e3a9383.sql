REVOKE EXECUTE ON FUNCTION public.is_build_staff(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_build_staff(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_build_staff(uuid) FROM authenticated;