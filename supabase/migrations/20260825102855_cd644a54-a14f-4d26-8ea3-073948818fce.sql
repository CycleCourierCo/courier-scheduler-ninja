REVOKE ALL ON FUNCTION public.set_claim_created_by() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_claim_created_by() TO service_role;