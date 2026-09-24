REVOKE ALL ON FUNCTION public.guard_inspection_receiver_wait_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_inspection_receiver_wait_status() FROM anon;
REVOKE ALL ON FUNCTION public.guard_inspection_receiver_wait_status() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.guard_inspection_receiver_wait_status() TO service_role;