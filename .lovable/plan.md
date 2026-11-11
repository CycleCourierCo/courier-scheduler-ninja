# Show the final destination on Box My Bike orders

## The problem
When an order becomes Box My Bike, the delivery address gets replaced with the depot. The buyer's name, email and phone are kept, but their address isn't, so staff can't tell where the bike is finally going when a customer gets in touch.

## What changes
1. **Ask for the final destination when converting.** The "Convert to Box My Bike" form gets an address section, pre-filled from the delivery address the order had before it was switched to the depot. Staff can edit it. It's optional, so a conversion is never blocked.
2. **Show it everywhere staff look:**
   - Box My Bike board: a "Final destination" line on each card (town and postcode, with the full address when you open the card).
   - Order page: a "Final destination" box next to the buyer details, which staff can edit afterwards.
   - Customer service inbox: when a message is linked to a Box My Bike order, the order details panel shows the final destination and the buyer.
   - The order search on the Box My Bike board also matches the destination postcode or town.
3. **Older orders.** For orders already converted, I'll try to recover the original delivery address from the order's change history. Any I can't recover will show "Final destination not recorded – add it", with a button to fill it in.

## What stays the same
The delivery address stays as the depot, so routes, labels, Shipday and invoicing work exactly as they do now. Emails to the buyer don't change.

## Technical details
- Store the destination as `box_buyer.address` (same JSONB shape as the order's `receiver.address`), so no new column is needed. Map it in `orderServiceUtils.ts` and add it to `Order.boxBuyer`.
- `BoxMyBikeConversion.tsx`: capture the original `order.receiver.address` before the depot overwrite and add address fields.
- Shared `BoxFinalDestination` display component used by `BoxMyBikePage.tsx` (add `box_buyer` to its select), the order detail page and the CS inbox order panel.
- Backfill: first check `order_update_log` / webhook history for the original receiver address. Only write a backfill where it's found, and report how many couldn't be recovered.
- Test: conversion keeps the original receiver address as the final destination while the receiver becomes the depot.
