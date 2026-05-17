## Goal

When Shipday reports `ORDER_FAILED`:
1. Reset the affected leg (collection or delivery) — clear scheduled date/timeslot and shipday id for that leg.
2. Recompute the order status using the same logic as the manual "Reset Collection/Delivery Date" buttons.
3. Re-create the Shipday job for that leg automatically so it can be re-scheduled.
4. Make failure events always render in the order's tracking timeline, even after the Shipday id has been replaced.

## 1. `supabase/functions/shipday-webhook/index.ts` — ORDER_FAILED branch

Replace the current `ORDER_FAILED` handling (lines 144-151) with full leg-reset logic:

- Compute `senderSet` / `receiverSet` from `pickup_date` / `delivery_date` JSONB (non-empty array).
- Compute `newStatus`:
  - Pickup failed: same as `computeRevertStatus(false)` — `scheduled_dates_pending` if both set, else `sender_availability_pending` / `receiver_availability_pending`.
  - Delivery failed: same as `computeRevertStatus(true)` — preserve `'collected'` when already collected, otherwise same rules as above.
- Add to the `updateData` payload (alongside status + tracking_events):
  - Pickup failed: `scheduled_pickup_date: null`, `pickup_timeslot: null`, `shipday_pickup_id: null`.
  - Delivery failed: `scheduled_delivery_date: null`, `delivery_timeslot: null`, `shipday_delivery_id: null`.
- When appending the failure update to `tracking_events.shipday.updates`, also store `leg: 'pickup' | 'delivery'` on the event (new field) so the timeline can identify it after the shipday id is cleared.
- Also update `tracking_events.shipday.pickup_id` / `delivery_id` to `null` for the cleared leg so the snapshot stays consistent.
- After the DB update succeeds, invoke `create-shipday-order` with `{ orderId: dbOrder.id, jobType: 'pickup' | 'delivery' }` via `supabase.functions.invoke(...)` to re-create the job in Shipday. Log errors but don't fail the webhook response.

Select columns expanded to include `pickup_date, delivery_date, order_collected` for the status computation.

## 2. `src/components/order-detail/TrackingTimeline.tsx` — show failures regardless of current shipday id

In the `ORDER_FAILED` rendering block (around lines 246-256), determine leg from (in priority):
1. `update.leg === 'pickup' | 'delivery'` (newly written by the webhook).
2. Fallback for legacy events: existing `update.orderId === pickupId` / `=== deliveryId` match.
3. Final fallback: if neither, still render a generic "Job Failed" entry instead of skipping — so historical failures are never silently dropped.

Apply the same leg-aware logic to `ORDER_ONTHEWAY` and `ORDER_COMPLETED` so future events written with `leg` keep rendering correctly after id rotation.

Add `leg?: 'pickup' | 'delivery'` to the `ShipdayUpdate` type in `src/types/order.ts`.

## 3. Notes

- No schema changes; `tracking_events` is JSONB and `leg` is just a new optional field.
- No frontend changes needed for the manual reset handlers — webhook now mirrors their behaviour.
- `create-shipday-order` already supports `jobType` (see `src/services/shipdayService.ts`), so re-creation is a single invoke call.
