REVOKE ALL ON public.lost_found_items FROM anon, PUBLIC;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.lost_found_items FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.lost_found_items TO authenticated;
GRANT ALL ON public.lost_found_items TO service_role;