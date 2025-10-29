-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create cron job to generate timeslips daily at 00:05 UTC
SELECT cron.schedule(
  'generate-daily-timeslips',
  '5 0 * * *', -- Run at 00:05 UTC every day
  $$
  SELECT
    net.http_post(
        url:='https://axigtrmaxhetyfzjjdve.supabase.co/functions/v1/generate-timeslips',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4aWd0cm1heGhldHlmempqZHZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE3NDA4MDMsImV4cCI6MjA1NzMxNjgwM30.POm5myoyMwKjkMfYMw2gRFs-cgD7GDznv338qiadugg"}'::jsonb,
        body:=json_build_object('date', (CURRENT_DATE - INTERVAL '1 day')::TEXT)::jsonb
    ) as request_id;
  $$
);