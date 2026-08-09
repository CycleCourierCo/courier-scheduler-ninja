# Proactive customer updates: cron fires, function crashes

## What I found

The cron job itself is healthy — `send-order-updates-daily` runs at 08:00 UTC daily and succeeded on 7, 8 and 9 Aug. But the HTTP call it makes returns **500 `{"error":"Failed to send updates"}`** (confirmed in today's 08:00 response record), so no update emails go out. The only rows in the update log are from manual "Send update now" clicks (6 on 6 Aug, 2 on 8 Aug).

Cause: the function filters out "dead" orders with the list `delivered, cancelled, delivered_by_3p, delivered_ni`. `delivered_ni` is **not** a value in the `order_status` enum (valid values end at `delivered_to_ferry`), so Postgres rejects the whole query with `22P02: invalid input value for enum order_status: "delivered_ni"`. The function throws before scanning a single order — which is why the whole run silently produces nothing.

## The fix

- Replace `delivered_ni` with the real value `delivered_to_ferry` in the dead-status list in `supabase/functions/send-order-updates/index.ts`.
  - Note: ferry hand-off is not the end of an NI job's customer journey, so for NI orders it stays in scope only if we want post-ferry updates. Plan: treat `delivered_to_ferry` as dead (matches the current intent of the list) and rely on the existing ferry confirmation email for that milestone.
- Make failures visible instead of silent:
  - Surface non-`Error` throwables properly, so a bad query returns the real Postgres message rather than the generic "Failed to send updates".
  - Log a one-line run summary (scanned / sent / skipped) and, on failure, the error code so a broken run is obvious in the function logs.
- Run the function once manually after the fix to confirm it scans orders and sends the updates that are actually due, then verify new rows appear in `order_update_log`.

## Technical notes

- Single file changed: `supabase/functions/send-order-updates/index.ts` (the `deadStatuses` array plus the catch-block error reporting).
- No database or frontend changes; the cron entry, wrapper function `invoke_send_order_updates()` and `x-cron-secret` handling are all working correctly.
