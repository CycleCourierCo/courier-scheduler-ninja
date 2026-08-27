# Make cancellation actually remove the job from Shipday

## What I found

Cancelling from the order page does call the Shipday delete, but the cancel is not sealed off afterwards, so the job comes back:

- Cancelling never clears `shipday_pickup_id` / `shipday_delivery_id` or the `tracking_events.shipday` block. Cancelled orders in the database still hold live Shipday ids.
- Two cancelled orders had a fresh Shipday **create** written *after* they were cancelled: `CCC754597771342CHRE4` (Shipday pair 52393728/52393731 written 10:45 today) and `CCC754115985772JAMNE9` (new pickup 52396109 written 12:25 today). So the 15-minute `backfill-shipday-jobs` safety net and the failed-collection reconcile path can re-create legs for an order that was already cancelled.
- The delete only looks at the two flat columns. When those are stale or empty (ids live in `tracking_events.shipday` instead — e.g. `CCC754621927033MHUHP4` holds pickup 51400068 while its tracking block was rewritten at 11:08), the real Shipday job is never deleted.
- If the delete fails, the UI shows a warning toast only and the order is still marked cancelled, so nobody notices the job is still live on Shipday.

## Fix

1. **Cancel server-side, in one step.** New edge function `cancel-order` (staff auth) that:
   - collects every known Shipday id from both the flat columns and `tracking_events.shipday`,
   - deletes each leg on Shipday (404 counts as already gone),
   - writes `status = 'cancelled'`, nulls both id columns, and stamps `tracking_events.shipday.cancelled_at` plus the deleted ids,
   - returns a clear failure if any leg could not be deleted.
2. **Block silent failures.** The order page calls this function instead of the current delete-then-update sequence. If Shipday deletion fails, show a blocking error with a "Cancel anyway" confirmation, and keep an explicit "Remove from Shipday" retry button on cancelled orders.
3. **Stop resurrection.** In `backfill-shipday-jobs`, re-read the order's status immediately before each create and skip anything cancelled/terminal or carrying a `cancelled_at` marker. Same guard in `reconcile-shipday-orders` so webhook replays can't re-add legs to a cancelled order.
4. **Clean up existing mess.** One-off pass over currently cancelled orders that still hold Shipday ids: delete those legs on Shipday and null the ids, so nothing lingers on the dispatch board.

## Technical notes

- Files: new `supabase/functions/cancel-order/index.ts`; changes in `src/pages/OrderDetail.tsx`, `src/services/shipdayService.ts`, `supabase/functions/backfill-shipday-jobs/index.ts`, `supabase/functions/reconcile-shipday-orders/index.ts`.
- Cancellation emails keep firing as today, after the Shipday teardown.
- The existing `delete-shipday-order` function stays for the manual retry button.
