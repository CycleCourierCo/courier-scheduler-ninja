# Timeslip Generation Cron Job Monitoring

This document provides SQL queries and instructions for monitoring the health and status of the automated timeslip generation cron job.

## Cron Job Overview

- **Job Name:** `generate-daily-timeslips`
- **Schedule:** Daily at 00:05 UTC
- **Function:** Invokes the `generate-timeslips` edge function to create timeslips for completed Shipday orders

---

## Quick Health Check Queries

### 1. Check Recent Cron Job Executions

```sql
-- View the last 10 cron job runs
SELECT 
  runid,
  start_time AT TIME ZONE 'UTC' as start_time_utc,
  end_time AT TIME ZONE 'UTC' as end_time_utc,
  status,
  return_message,
  (end_time - start_time) as duration
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'generate-daily-timeslips')
ORDER BY start_time DESC
LIMIT 10;
```

**Expected Result:**
- `status` should be `succeeded`
- `return_message` should be `200` (HTTP OK)
- `duration` should be under 30 seconds typically

---

### 2. Check Extension Status

```sql
-- Verify required extensions are enabled
SELECT 
  extname, 
  extversion,
  CASE 
    WHEN extname = 'pg_cron' THEN '✅ Cron scheduling'
    WHEN extname = 'pg_net' THEN '✅ HTTP requests from cron'
  END as purpose
FROM pg_extension 
WHERE extname IN ('pg_net', 'pg_cron')
ORDER BY extname;
```

**Expected Result:**
- Both `pg_net` and `pg_cron` should be present
- Versions should be recent (pg_net ~0.19+, pg_cron ~1.6+)

---

### 3. Check Last Successful Run

```sql
-- Find when the job last ran successfully
SELECT 
  MAX(start_time) AT TIME ZONE 'UTC' as last_successful_run_utc,
  COUNT(*) as successful_runs_last_7_days,
  EXTRACT(EPOCH FROM (NOW() - MAX(start_time)))/3600 as hours_since_last_run
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'generate-daily-timeslips')
  AND status = 'succeeded'
  AND start_time > NOW() - INTERVAL '7 days';
```

**Expected Result:**
- `last_successful_run_utc` should be within the last 24-26 hours
- `successful_runs_last_7_days` should be ~7 (one per day)

---

### 4. Check Timeslip Generation Logs

```sql
-- View recent timeslip generation runs from the application logs
SELECT 
  run_date,
  execution_time AT TIME ZONE 'UTC' as execution_time_utc,
  status,
  timeslips_created,
  drivers_processed,
  execution_duration_ms,
  warnings,
  error_message
FROM public.timeslip_generation_logs
ORDER BY execution_time DESC
LIMIT 10;
```

**Expected Result:**
- `status` should be `success` or `partial` (with warnings)
- `timeslips_created` should match `drivers_processed` typically
- `error_message` should be NULL

---

### 5. Identify Failed Runs

```sql
-- Find any failed cron job runs in the last 7 days
SELECT 
  start_time AT TIME ZONE 'UTC' as failed_at_utc,
  status,
  return_message,
  command
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'generate-daily-timeslips')
  AND status != 'succeeded'
  AND start_time > NOW() - INTERVAL '7 days'
ORDER BY start_time DESC;
```

**Expected Result:**
- Should be empty (no failures)
- If rows appear, check `return_message` for error details

---

### 6. Check for Missing Daily Runs

```sql
-- Identify dates in the last 7 days with no timeslip generation
WITH expected_dates AS (
  SELECT generate_series(
    CURRENT_DATE - INTERVAL '7 days',
    CURRENT_DATE - INTERVAL '1 day',
    '1 day'::interval
  )::date AS expected_date
)
SELECT 
  ed.expected_date,
  CASE 
    WHEN tl.run_date IS NULL THEN '❌ MISSING'
    ELSE '✅ ' || tl.status
  END as status,
  tl.timeslips_created,
  tl.drivers_processed
FROM expected_dates ed
LEFT JOIN public.timeslip_generation_logs tl ON ed.expected_date = tl.run_date
ORDER BY ed.expected_date DESC;
```

**Expected Result:**
- All dates should have a matching run (not MISSING)

---

## Troubleshooting Guide

### Issue: Cron job showing "failed" status

**Check:**
1. Look at `return_message` in the cron job details
2. Common errors:
   - `ERROR: schema "net" does not exist` → pg_net extension not enabled
   - `500` → Edge function error, check edge function logs
   - `Connection timeout` → Network issue or edge function taking too long

**Solution:**
```sql
-- Re-enable pg_net if needed
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA net TO postgres;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA net TO postgres;
```

---

### Issue: No timeslips being created

**Check:**
1. Verify Shipday has completed orders for that date
2. Check timeslip generation logs for warnings
3. Verify driver Shipday IDs match database profiles

**Diagnostic Query:**
```sql
-- Check which drivers have Shipday IDs configured
SELECT 
  name,
  email,
  shipday_driver_id,
  role,
  is_active
FROM profiles
WHERE role = 'driver'
ORDER BY name;
```

---

### Issue: Cron job not running at all

**Check:**
1. Verify the cron job is still scheduled:
```sql
SELECT * FROM cron.job WHERE jobname = 'generate-daily-timeslips';
```

2. Check if the job is active:
```sql
SELECT 
  jobname,
  schedule,
  active,
  database
FROM cron.job 
WHERE jobname = 'generate-daily-timeslips';
```

**Solution:**
If the job is missing or inactive, recreate it:
```sql
SELECT cron.schedule(
  'generate-daily-timeslips',
  '5 0 * * *', -- 00:05 UTC daily
  $$
  SELECT
    net.http_post(
        url:='https://axigtrmaxhetyfzjjdve.supabase.co/functions/v1/generate-timeslips',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4aWd0cm1heGhldHlmempqZHZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE3NDA4MDMsImV4cCI6MjA1NzMxNjgwM30.POm5myoyMwKjkMfYMw2gRFs-cgD7GDznv338qiadugg"}'::jsonb,
        body:=concat('{"date": "', (CURRENT_DATE - INTERVAL '1 day')::text, '"}')::jsonb
    ) as request_id;
  $$
);
```

---

## Edge Function Logs

To view detailed execution logs for the edge function:

1. **Via Supabase Dashboard:**
   - Go to: https://supabase.com/dashboard/project/axigtrmaxhetyfzjjdve/functions/generate-timeslips/logs
   - Look for entries starting with `=== GENERATE TIMESLIPS STARTED ===`

2. **Via SQL Query:**
```sql
-- Note: This requires access to Supabase analytics/logging tables
-- Contact Supabase support if you need historical function logs beyond the dashboard
```

---

## Monitoring Best Practices

1. **Daily Check** (automated via email):
   - Email notifications are sent to `info@cyclecourierco.com` after each run
   - Subject line indicates success/failure/warnings

2. **Weekly Review**:
   - Run the "Check for Missing Daily Runs" query
   - Review any warnings in `timeslip_generation_logs`

3. **Monthly Audit**:
   - Compare timeslips created vs expected based on Shipday activity
   - Verify all active drivers have matching Shipday IDs

4. **Alert Triggers**:
   - Set up alerts if:
     - Cron job fails 2 days in a row
     - 0 timeslips created when Shipday has orders
     - Execution time exceeds 60 seconds

---

## Common Warning Messages

| Warning | Meaning | Action |
|---------|---------|--------|
| `Driver not found in database with Shipday ID: XXX` | Driver exists in Shipday but not linked in database | Add `shipday_driver_id` to the driver's profile |
| `No carrier ID found for driver: NAME` | Shipday order missing carrier information | Check Shipday data quality |
| `Database error creating timeslip` | Database constraint or connection issue | Check Supabase database status |

---

## Contact & Support

- **Edge Function Logs:** https://supabase.com/dashboard/project/axigtrmaxhetyfzjjdve/functions/generate-timeslips/logs
- **Database Status:** https://supabase.com/dashboard/project/axigtrmaxhetyfzjjdve
- **Email Notifications:** info@cyclecourierco.com
