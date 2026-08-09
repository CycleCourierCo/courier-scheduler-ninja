# Manual test: proactive customer updates job

Run the `send-order-updates` function live, exactly as the 08:00 cron does, and report the results.

## Steps

1. Confirm the function is deployed with the latest fix (`delivered_to_ferry` status filter).
2. Invoke it with the same payload/headers the cron uses (including the `X-Cron-Secret` header) so the auth path is tested too.
3. Read the returned summary: orders scanned, updates sent, skipped (and skip reasons), errors.
4. Pull the function logs for the run to confirm no Postgres or Resend/SendZen errors.
5. Report back: how many customers were emailed, which were skipped and why, and whether the receiver-dates chaser correctly stayed gated behind inspected/repaired.

## Note

This is a live run — eligible customers will receive real update emails now. No code changes are planned; if the run surfaces a bug, I'll report it and propose a fix before changing anything.
