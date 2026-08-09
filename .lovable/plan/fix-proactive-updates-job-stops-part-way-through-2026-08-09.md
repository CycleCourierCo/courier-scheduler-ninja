# Fix: proactive updates job stops part-way through

## What actually happened

The run did not "only find 28 orders" — it was cut off mid-way.

- 233 live orders were scanned; 185 of them were due an update (48 were inside the 2-day quiet window from a recent email).
- 60 emails were written to the log between 09:43:02 and 09:43:52, then the run stopped dead.
- Cause: the scheduled job calls the function with `net.http_post` and no timeout, so it uses the default 5-second limit. When the caller gives up, the request is aborted and the running worker is torn down — the function is still looping through orders one at a time, sending each email and querying the log per order, so it never gets past roughly the first 60.

So the low number is a timeout, not the update rules.

## Fix

1. **Return immediately, work in the background.** Respond 200 as soon as the job is accepted and continue the whole scan inside `EdgeRuntime.waitUntil()`, so the caller hanging up can no longer kill the run.
2. **Give the caller an explicit timeout anyway.** Add a `timeout_milliseconds` argument to the scheduled call so the trigger doesn't abort at 5 seconds.
3. **Make the loop much faster.**
   - Fetch the last 2 days of `order_update_log` rows once up front, instead of one query per order.
   - Send emails in small parallel batches (about 5 at a time) rather than strictly one after another.
4. **Log a real summary.** At the end of the background run, log scanned / sent / skipped / failed counts so a truncated run is obvious next time.
5. **Keep single-order manual sends synchronous** so the "send update now" button still reports its result straight back to the user.

## Verify

Re-run the job manually, then confirm the log shows a full pass: roughly 185 orders due, sent count matching, and a completion summary in the function logs.

## Technical notes

- File: `supabase/functions/send-order-updates/index.ts` (background wrapper, pre-fetched quiet-period map, batched sends).
- Database: replace `public.invoke_send_order_updates()` with a version passing `timeout_milliseconds`.
- No changes to which customers qualify for an update or to email content.
