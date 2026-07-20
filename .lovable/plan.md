# Fix weekly invoice batch cron

## What's happening today

Today's cron (Mon 2026-07-20 01:00 UTC) fired — pg_cron reports `succeeded` — but:

- **No rows added to `invoice_history` today.**
- **No edge-function logs exist for `weekly-invoice-batch` at all.**
- Last week is the same: the 2026-07-13 Monday cron produced nothing. The invoices dated 07-15 / 07-16 are one-per-customer, seconds apart — manual "Create All Invoices" clicks from the Invoices page.

## Root cause

`public.invoke_weekly_invoice_batch()` calls `net.http_post` without overriding pg_net's default 5-second timeout. The batch function loops every approved b2b customer and calls `create-quickbooks-invoice` for each — well over 5s. pg_net drops the connection, the edge runtime aborts the function before any log is flushed, and no invoices get created. (Same pattern shows in today's `net._http_response` timeouts at 03:00 / 05:00.)

## Fix

1. **Extend the pg_net timeout on the cron caller.** Update `public.invoke_weekly_invoice_batch()` to pass `timeout_milliseconds := 300000` (5 min) to `net.http_post`.
2. **Make the batch survive client disconnects.** In `supabase/functions/weekly-invoice-batch/index.ts`, run the per-customer loop + report email inside `EdgeRuntime.waitUntil(...)` and return `202 Accepted` immediately.
3. **Add persistent run logging.** New table `public.weekly_invoice_batch_logs` (id, run_started_at, run_completed_at, range_start, range_end, range_label, successful_count, failed_count, skipped_count, status, error_message, created_at) with admin-read RLS + service_role grants — mirrors `timeslip_generation_logs`. Write one row per run (started at entry, updated on completion/error) so we always know what happened without depending on edge-function log retention.
4. **Manual re-run helper.** Keep the existing body override (`{startDate, endDate}`) so a specific week can be replayed on demand.

## Technical details

- Migration: alter `invoke_weekly_invoice_batch()` and create `weekly_invoice_batch_logs` (with `GRANT SELECT` to authenticated + `GRANT ALL` to service_role, RLS enabled, admin-select policy).
- Edge function change: insert log row → `EdgeRuntime.waitUntil(processBatch())` → return 202. `processBatch` updates the log row on completion/failure.
- No UI changes; Invoices page manual button keeps working as-is.
- Not run in this plan: I will not manually re-invoke the function or backfill last week's invoices. If you want last week re-run after the fix ships, say so and I'll POST `{startDate, endDate}` for that window.
