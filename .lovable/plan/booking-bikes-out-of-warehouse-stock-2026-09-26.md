# Booking bikes out of warehouse stock

## What happens today when a customer books a bike out
- A new delivery order is created with status "Created", from the depot to the receiver.
- **Collected:** No. The order is not marked collected, even though the bike is already with us.
- **Shipday:** Only a delivery job is requested (no collection job, which is correct). It is pushed from the customer's browser; if that fails, the 15-minute backfill should add it.
- **Receiver email:** Yes. The receiver gets the order notification and a request for delivery dates (unless the bike needs inspection first).
- **Bay:** The stock bay (e.g. N10) is not copied onto the new order, so loaders and the order page show no location.

## Why bays look unassigned
Warehouse bikes store their bay on the stock record only. The Storage Bays and loading screens read bays from orders, so stock bikes never show as occupying a bay, and the booked-out order has no bay either.

## Changes
1. When a bike is booked out, mark the order **collected** straight away (status Collected, collected flag on), so it goes straight to delivery scheduling.
2. Copy the stock bay/position onto the new order so it shows on the order page, loading list and labels.
3. Show stored warehouse bikes as occupied on the Storage Bays page, and stop the bay being offered to other bikes.
4. Free the bay when the order is delivered or the stock is dispatched.
5. Confirm the Shipday delivery job goes through the server-side booking path (no browser-only call), so it's created reliably.

## Technical notes
- `requestDeliveryFromStock`: insert with `status: 'collected'`, `order_collected: true`, `storage_locations: [{bay, position}]`; call the existing `sync-order-shipday` path with `delivery` leg.
- Storage bay occupancy query merges `warehouse_stock` rows (status stored/reserved, item_kind bike) with order allocations.
- Check customer RLS allows setting these fields on insert; adjust via migration only if blocked.
