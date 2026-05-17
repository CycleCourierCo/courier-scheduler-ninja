Update the two reset handlers in `src/pages/OrderDetail.tsx` so they restore the order to the correct prior status instead of leaving it as `scheduled` / `collection_scheduled` / `delivery_scheduled`.

## Status helpers (computed from current `order`)

- `senderSet` = `order.pickupDate` is a non-empty array (sender availability chosen)
- `receiverSet` = `order.deliveryDate` is a non-empty array (receiver availability chosen)
- `collected` = `order.status === 'collected'` (bike already picked up)

## `handleResetPickupDate` (Reset Collection Date)

Add `status` to the update payload, chosen as:
- both `senderSet` && `receiverSet` → `'scheduled_dates_pending'`
- `!senderSet` → `'sender_availability_pending'`
- `senderSet` && `!receiverSet` → `'receiver_availability_pending'`

## `handleResetDeliveryDate` (Reset Delivery Date)

Add `status` to the update payload, chosen as:
- `collected` → `'collected'`
- else both `senderSet` && `receiverSet` → `'scheduled_dates_pending'`
- else `!senderSet` → `'sender_availability_pending'`
- else `senderSet` && `!receiverSet` → `'receiver_availability_pending'`

## Notes

- Only the reset handlers change; no schema, RLS, or other UI changes.
- Existing local state resets, refetch, and toast messages are preserved.
