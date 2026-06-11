## Problem

When an order has `needs_inspection = true`, the receiver should not be asked to pick delivery availability until the inspection is finished (all approved repairs done, or all issues declined).

Today, the deferral logic exists only in `confirmSenderAvailability` (sender-driven flow in `src/services/availabilityService.ts`). Several other code paths bypass that check and still email the receiver / move the order into `receiver_availability_pending`:

1. **Admin bulk submit** — `src/pages/BulkAvailabilityPage.tsx` updates sender dates and unconditionally moves status to `receiver_availability_pending` + sends the receiver email.
2. **Admin manual reset** — `handleResetReceiverAvailability` in `src/pages/OrderDetail.tsx` and the "resend receiver availability" button always call `resendReceiverAvailabilityEmail`.
3. **Warehouse-stock release flow** — `src/services/warehouseStockService.ts` calls `sendReceiverAvailabilityEmail(order.id)` directly with no inspection check.
4. **Public receiver page** — `src/pages/ReceiverAvailability.tsx` lets the receiver submit dates even if `needs_inspection` is true and inspection is not yet `repaired` (so a stale/old link still works).

## Fix

### 1. Centralise the check
Add a small helper in `src/services/inspectionService.ts`:

```ts
export const isReceiverAvailabilityBlockedByInspection = async (
  orderId: string
): Promise<boolean>
```

It returns `true` when `orders.needs_inspection = true` AND there is no inspection row in status `repaired` (i.e. inspection not yet completed). Used by every receiver-availability trigger.

### 2. Gate every trigger
- `src/services/availabilityService.ts` — keep existing check, also apply to the second flow (`updateSenderAvailability`, ~line 200) using the new helper.
- `src/pages/BulkAvailabilityPage.tsx` — before moving to `receiver_availability_pending` and sending the email, call the helper. If blocked, set status to `sender_availability_confirmed` instead and skip the email; surface a toast like "Receiver email deferred — bike awaiting inspection".
- `src/pages/OrderDetail.tsx` — gate both `handleResetReceiverAvailability` and the standalone "Resend receiver availability" button (line ~1101). If blocked, do not send the email and show a toast explaining why.
- `src/services/warehouseStockService.ts` — gate the `sendReceiverAvailabilityEmail` call the same way.

### 3. Hand-off after inspection
The existing `triggerReceiverAvailabilityIfDeferred` already fires when the inspection transitions to `repaired` inside `reconcileInspectionStatuses`. Add the same call to `markAsInspected` (no-issues path) so the receiver email is sent automatically once the bike is marked inspected with no issues — today this path never triggers it.

### 4. Block the public receiver page
In `src/pages/ReceiverAvailability.tsx` / `src/hooks/useAvailability.tsx`, after loading the order, if `needs_inspection` is true and inspection is not yet released/repaired, render an `ErrorState`-style message: "This delivery isn't ready to schedule yet — the bike is being inspected. We'll email you as soon as it's ready." Disable the form / submit. This prevents an already-sent old link from being used.

### 5. Server-side safety net (optional, recommended)
Add a Postgres trigger on `orders` that blocks transitions into `receiver_availability_pending` when `needs_inspection = true` and no completed inspection exists, so any future code path can't bypass it. (Migration; will require approval.)

## Files touched
- `src/services/inspectionService.ts` (new helper + hook into `markAsInspected`)
- `src/services/availabilityService.ts`
- `src/services/warehouseStockService.ts`
- `src/pages/BulkAvailabilityPage.tsx`
- `src/pages/OrderDetail.tsx`
- `src/pages/ReceiverAvailability.tsx` and/or `src/hooks/useAvailability.tsx`
- One migration for the safety-net trigger (optional)

## Out of scope
- No changes to sender flow, inspection workflow, or email templates.
- No changes to existing inspection status reconciliation logic beyond the new `markAsInspected` hand-off.

Shall I proceed, and do you want the optional DB trigger safety net included?