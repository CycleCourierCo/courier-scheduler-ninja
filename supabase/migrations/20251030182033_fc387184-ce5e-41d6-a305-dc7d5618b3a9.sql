-- Enable pg_net extension for HTTP requests from cron jobs
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant usage to postgres user (used by cron jobs)
GRANT USAGE ON SCHEMA net TO postgres;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA net TO postgres;

-- Create table to track timeslip generation runs
CREATE TABLE IF NOT EXISTS public.timeslip_generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date DATE NOT NULL,
  execution_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  timeslips_created INTEGER DEFAULT 0,
  drivers_processed INTEGER DEFAULT 0,
  warnings TEXT[],
  error_message TEXT,
  execution_duration_ms INTEGER
);

CREATE INDEX idx_generation_logs_date ON public.timeslip_generation_logs(run_date DESC);
CREATE INDEX idx_generation_logs_execution_time ON public.timeslip_generation_logs(execution_time DESC);

-- Enable RLS
ALTER TABLE public.timeslip_generation_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view generation logs
CREATE POLICY "Admins can view generation logs"
  ON public.timeslip_generation_logs
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::user_role));

-- Verify pg_net is installed
SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_net';