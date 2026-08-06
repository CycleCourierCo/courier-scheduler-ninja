# Stop delivery-date chasers while a bike is still in inspection

## The problem (confirmed)

For CCC754985535989GEOLE8 the order is `collected`, `needs_inspection = true`, the receiver has not given dates, and its inspection row is still at `issues_found` (not `inspected` / `repaired`).

The customer-updates engine has no inspection awareness: it chases the receiver for delivery dates purely on "sender confirmed + no delivery dates yet". Every other path in the app defers this via `isReceiverAvailabilityBlockedByInspection`, so the updates engine is the odd one out.

## The fix

Add the same inspection gate to the customer updates engine:

- When an order has `needs_inspection = true` and no inspection row has reached `inspected` or `repaired`, skip the "We need your delivery dates" chaser entirely.
- In that state the receiver still gets the depot/workshop update ("your bike is at our depot, workshop is working through inspection and any agreed work"), so they are not left silent — they just aren't asked for dates they can't sensibly give yet.
- Once the inspection completes (or repairs are declined) the existing deferred availability email fires as it does today, and from then on the chaser is allowed again.

## Technical detail

In `supabase/functions/send-order-updates/index.ts`:

- Load inspection status alongside the order: a single `bicycle_inspections` query (`order_id`, `status`) for the orders being processed in the run.
- Derive `inspectionPending = order.needs_inspection === true && !inspections.some(s => s === 'repaired' || s === 'inspected')`, mirroring `isReceiverAvailabilityBlockedByInspection` in `src/services/inspectionService.ts`.
- Guard the `awaiting_receiver_dates` push (currently line 208) with `&& !inspectionPending`.
- Leave the `in_depot` update as-is; its wording already covers the workshop stage.

No database or frontend changes needed.
