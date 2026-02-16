

# Fix: Timeslip Cron Job Authentication Failure

## Root Cause

There are **two duplicate cron jobs** (IDs 3 and 4), and **neither authenticates correctly**:

- **Job 3**: Sends only the anon key as `Authorization: Bearer <anon_key>`. The edge function requires admin JWT or a valid `X-Cron-Secret` header. The anon key is neither, so it gets a **401 Unauthorized**.

- **Job 4**: Attempts to include `X-Cron-Secret` but passes the literal string `'SELECT get_cron_secret()'` instead of the actual secret value. Inside `jsonb_build_object(...)`, SQL function calls are not evaluated -- it just becomes the text `"SELECT get_cron_secret()"`. The edge function compares this against the real vault secret and it doesn't match, so it also fails.

This means **no timeslips have been generated since the auth was added** (around Feb 13).

## Fix

1. **Delete both broken cron jobs** (IDs 3 and 4)
2. **Create a single correct cron job** that properly retrieves the secret from the vault and passes it in the `X-Cron-Secret` header

The trick is that `net.http_post` accepts `jsonb` for headers, but you can't call a function inside `jsonb_build_object` as a dynamic value in `cron.schedule`'s static SQL string. Instead, we need to use a **wrapper function** or use `concat` / subquery to inject the secret value.

### Technical approach

Create a small helper function that builds and sends the HTTP request, so the `get_cron_secret()` call is evaluated at runtime:

```sql
-- Step 1: Remove both broken cron jobs
SELECT cron.unschedule(3);
SELECT cron.unschedule(4);

-- Step 2: Create a helper function that builds the request with the real secret
CREATE OR REPLACE FUNCTION public.invoke_generate_timeslips()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cron_secret TEXT;
  request_id BIGINT;
BEGIN
  -- Get the secret from vault
  cron_secret := get_cron_secret();
  
  -- Make the HTTP request with the real secret in the header
  SELECT net.http_post(
    url := 'https://axigtrmaxhetyfzjjdve.supabase.co/functions/v1/generate-timeslips',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4aWd0cm1heGhldHlmempqZHZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE3NDA4MDMsImV4cCI6MjA1NzMxNjgwM30.POm5myoyMwKjkMfYMw2gRFs-cgD7GDznv338qiadugg',
      'X-Cron-Secret', cron_secret
    ),
    body := jsonb_build_object('date', (CURRENT_DATE - INTERVAL '1 day')::DATE::TEXT)
  ) INTO request_id;
END;
$$;

-- Step 3: Schedule the single correct cron job
SELECT cron.schedule(
  'generate-daily-timeslips',
  '5 0 * * *',
  $$ SELECT public.invoke_generate_timeslips(); $$
);
```

### What this fixes

- The helper function calls `get_cron_secret()` at **runtime**, so the real secret value is sent
- The edge function's `requireAdminOrCronAuth` will match the `X-Cron-Secret` header against the vault secret and authenticate successfully
- Only one cron job instead of two duplicates

### After deployment

We should manually trigger the function for any missed dates (Feb 13-15) to backfill the missing timeslips.

