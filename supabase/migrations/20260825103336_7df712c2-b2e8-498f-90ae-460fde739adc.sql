REVOKE ALL ON FUNCTION public.set_claim_ref() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.log_claim_status_change() FROM PUBLIC, anon, authenticated, service_role;