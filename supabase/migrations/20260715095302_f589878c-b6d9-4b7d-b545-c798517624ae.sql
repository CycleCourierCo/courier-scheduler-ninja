REVOKE EXECUTE ON FUNCTION public.update_user_profile_for_management(uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_user_profile_for_management(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_user_profile_for_management(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_profile_for_management(uuid, jsonb) TO service_role;