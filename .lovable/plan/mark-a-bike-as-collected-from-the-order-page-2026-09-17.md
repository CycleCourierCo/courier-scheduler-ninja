# Mark a bike as collected from the order page

## What changes

1. **New "Mark as collected" button** at the top of an order, next to the status dropdown. It only appears when the bike isn't already marked collected, and asks for confirmation first.
2. **Changing the status to "Collected" does the same thing** — the order is flagged as collected, not just labelled.
3. Once marked collected, the order shows as **Collected** on the Get Timeslots / route popup (that view already reads the collected flag, so it picks this up straight away) and stops being chased for collection dates.
4. If the buyer hasn't given delivery dates yet, the system **emails them to choose their delivery dates** — unless the bike is still in inspection or repair, in which case the email is deferred exactly as it is today, and staff are told so.

## Behaviour details

- Marking collected sets the collected flag and the status to Collected in one go.
- If the buyer has already confirmed delivery dates, no email is sent.
- Already-collected orders: the button is hidden and re-picking "Collected" does nothing.
- Nothing is sent to Shipday and no existing collection dates or route bookings are altered.

## Technical notes

- `src/services/orderService.ts`: add `markOrderCollected(id)` — updates `orders` with `order_collected: true`, `status: 'collected'`, `updated_at`, returns the mapped order.
- `src/pages/OrderDetail.tsx`: new `handleMarkCollected` that calls it, sets local order state, then checks `isReceiverAvailabilityBlockedByInspection(id)` and calls `resendReceiverAvailabilityEmail(id)` when not blocked and `receiverConfirmedAt`/`deliveryDate` are empty (both helpers already imported and used by `handleResetReceiverAvailability`). In `handleStatusChange`, route `newStatus === 'collected'` through the same path instead of the plain status update.
- `src/components/order-detail/OrderHeader.tsx`: add `onMarkCollected` and `orderCollected` props and render the button (secondary variant, package icon) with a `window.confirm` guard, disabled while updating.
- No database, RLS or edge function changes — `order_collected` already exists and `RouteBuilder`/`JobScheduling` already derive collection status from it.
