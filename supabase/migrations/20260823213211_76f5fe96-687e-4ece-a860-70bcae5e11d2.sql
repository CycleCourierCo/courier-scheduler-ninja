CREATE TABLE public.integration_call_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider text NOT NULL,
  direction text NOT NULL DEFAULT 'outbound',
  operation text NOT NULL,
  status_code integer,
  success boolean NOT NULL DEFAULT true,
  duration_ms integer,
  error_label text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.integration_call_logs TO authenticated;
GRANT ALL ON public.integration_call_logs TO service_role;

ALTER TABLE public.integration_call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal staff can view integration call logs"
ON public.integration_call_logs
FOR SELECT
TO authenticated
USING (public.is_internal_staff((SELECT auth.uid())));

CREATE INDEX idx_integration_call_logs_created_at ON public.integration_call_logs (created_at DESC);
CREATE INDEX idx_integration_call_logs_provider_created ON public.integration_call_logs (provider, created_at DESC);

CREATE OR REPLACE FUNCTION public.cleanup_integration_call_logs()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.integration_call_logs WHERE created_at < now() - interval '30 days';
$$;

REVOKE ALL ON FUNCTION public.cleanup_integration_call_logs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_integration_call_logs() TO service_role;