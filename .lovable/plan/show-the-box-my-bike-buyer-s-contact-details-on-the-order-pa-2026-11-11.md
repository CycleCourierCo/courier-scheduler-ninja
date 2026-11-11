# Show the Box My Bike buyer's contact details on the order page

## What you'll see
On the order page of any Box My Bike order, a new **Buyer (final customer)** card next to the Sender and Receiver details shows:
- Name
- Phone (tap to call)
- Email (tap to email)

The buyer details are already saved on each order but aren't shown anywhere on the page right now. If an order has no buyer saved, the card says "No buyer details recorded". Orders that aren't Box My Bike don't change.

Nothing else changes: no new fields, no address, no changes to the Box My Bike board, the inbox or emails.

## Technical details
- New small `BoxBuyerCard` in `src/components/order-detail/`, shown only when `order.isBoxMyBike`, reading `order.boxBuyer` (already mapped in `orderServiceUtils.ts`).
- Placed beside the existing sender/receiver contact cards on the order detail page, using semantic tokens only.
- Add a roadmap entry for this task.
- No database changes.
