CREATE TABLE public.api_request_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_id uuid NULL REFERENCES public.api_keys(id) ON DELETE SET NULL,
  user_id uuid NULL,
  endpoint text NOT NULL,
  method text NOT NULL,
  status_code integer NOT NULL,
  duration_ms integer NOT NULL DEFAULT 0,
  success boolean NOT NULL DEFAULT false,
  error_code text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.api_request_logs TO authenticated;
GRANT ALL ON public.api_request_logs TO service_role;

ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view api request logs"
ON public.api_request_logs
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM (SELECT auth.uid() AS uid) a WHERE public.has_role(a.uid, 'admin'::user_role)));

CREATE POLICY "Owners can view their own api request logs"
ON public.api_request_logs
FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE INDEX api_request_logs_created_at_idx ON public.api_request_logs (created_at DESC);
CREATE INDEX api_request_logs_user_id_idx ON public.api_request_logs (user_id);
CREATE INDEX api_request_logs_api_key_id_idx ON public.api_request_logs (api_key_id);