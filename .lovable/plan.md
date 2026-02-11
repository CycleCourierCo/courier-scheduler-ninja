

# Fix Timeslip Cron Job and Backfill Missing Days

## Problem
The daily timeslip generation cron job is failing silently because:
1. **Missing authentication**: The cron job sends only the `anon` key as a Bearer token, but `generate-timeslips` requires either an admin JWT or an `X-Cron-Secret` header. The anon token fails admin auth, so the function returns 401.
2. **Duplicate cron jobs**: Two identical jobs (jobid 2 and 3) are scheduled at the same time.

## Fix (3 steps, all via SQL in Supabase)

### Step 1: Delete both existing cron jobs
Remove the two broken/duplicate jobs.

### Step 2: Create a new cron job with the X-Cron-Secret header
The new job will include an `X-Cron-Secret` header retrieved from Supabase Vault (using `get_cron_secret()`), which the `requireAdminOrCronAuth` function already supports.

The SQL will:
- Call `get_cron_secret()` at schedule time to fetch the secret from vault
- Pass it as the `X-Cron-Secret` header alongside the existing `Authorization` and `Content-Type` headers

### Step 3: Manually trigger timeslip generation for missed dates
Run the edge function manually for Feb 9, 10, and 11 to backfill the missing timeslips.

## Technical Details

### New cron job SQL
```sql
-- Remove duplicates
SELECT cron.unschedule(2);
SELECT cron.unschedule(3);

-- Create corrected job with X-Cron-Secret header
SELECT cron.schedule(
  'generate-daily-timeslips',
  '5 0 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://axigtrmaxhetyfzjjdve.supabase.co/functions/v1/generate-timeslips',
        headers:=jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4aWd0cm1heGhldHlmempqZHZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE3NDA4MDMsImV4cCI6MjA1NzMxNjgwM30.POm5myoyMwKjkMfYMw2gRFs-cgD7GDznv338qiadugg',
          'X-Cron-Secret', (SELECT get_cron_secret())
        ),
        body:=json_build_object('date', (CURRENT_DATE - INTERVAL '1 day')::DATE::TEXT)::jsonb
    ) as request_id;
  $$
);
```

### Backfill missed dates
I will call the `generate-timeslips` edge function manually for each missed date (2026-02-09, 2026-02-10, 2026-02-11) using the edge function curl tool.

## No code file changes needed
This is entirely a database/infrastructure fix -- no application code changes required.

