## Root cause (verified)

The Monday 01:00 UTC cron job `weekly-invoice-batch` ran successfully at the Postgres level on both 2026-07-20 and 2026-07-27 (`cron.job_run_details` shows `succeeded`), and `pg_net` posted to the edge function. But the edge function rejected every call with **401 Unauthorized**, so no row was ever inserted into `weekly_invoice_batch_logs` (the insert happens after the auth check) and no invoices were created.

Why the 401:

- `supabase/functions/weekly-invoice-batch/index.ts` authorizes via `req.headers.get('X-Cron-Secret') === Deno.env.get('CRON_SECRET')`.
- `secrets--fetch_secrets` shows **no `CRON_SECRET` edge function secret is configured**. `Deno.env.get('CRON_SECRET')` returns empty, so the equality check short-circuits to false.
- Fallback path requires a Bearer token belonging to an admin user; the cron only sends the anon bearer, so `auth.getUser` returns null → 401.
- The Postgres wrapper `public.invoke_weekly_invoke_batch` fetches its header value from `vault.decrypted_secrets` (`name = 'cron_secret'`), but that value was never mirrored into edge function secrets.

Confirmed via `function_edge_logs` (only 401s for this function) and `weekly_invoice_batch_logs` being empty.

## Fix

1. Generate a fresh cron secret value.
2. Add it as an edge function secret named `CRON_SECRET` (via `secrets--add_secret`).
3. Update `vault.decrypted_secrets` entry `cron_secret` to the same value so `public.invoke_weekly_invoice_batch()` (and any other cron wrappers using `get_cron_secret()`) send a header that matches.
4. Manually trigger `public.invoke_weekly_invoice_batch()` to run last week's batch now (the one that was missed on Monday 2026-07-27), then verify:
   - `weekly_invoice_batch_logs` has a new row transitioning `running → completed`.
   - `function_edge_logs` shows a `202` for the initial call and the subsequent processing logs.
   - The report email is delivered and QuickBooks invoices are created for last week's range.

No application code changes are required — the edge function logic is correct, only the secret is missing.

## Notes

- Same pattern should be re-verified for any other cron that relies on `get_cron_secret()` (e.g. any function checking `X-Cron-Secret`). If we find others, they'll start working automatically once the secrets are aligned.
- If you'd prefer, we can skip the manual re-run and simply let it fire next Monday — but that means one more week without invoices.
