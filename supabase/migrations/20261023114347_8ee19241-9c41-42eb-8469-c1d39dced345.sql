ALTER FUNCTION public.get_cron_secret() SET search_path = '';
ALTER FUNCTION public.invoke_weekly_invoice_batch() SET search_path = public, extensions;
REVOKE EXECUTE ON FUNCTION public.get_cron_secret() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.invoke_weekly_invoice_batch() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_cron_secret() TO service_role;
GRANT EXECUTE ON FUNCTION public.invoke_weekly_invoice_batch() TO service_role;

ALTER TABLE public.labour_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labour_time_multipliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can read labour_times" ON public.labour_times FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in users can read labour_time_multipliers" ON public.labour_time_multipliers FOR SELECT TO authenticated USING (true);