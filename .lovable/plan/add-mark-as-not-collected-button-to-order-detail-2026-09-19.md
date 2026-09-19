# Add "Mark as not collected" button to order detail

## What you'll see
On the order detail page, when a bike is currently marked as collected, a new "Mark as not collected" button appears next to the status dropdown (where "Mark as collected" appears today). It asks for confirmation, then reverses the collection.

## What it does
1. Sets the collected flag to `false` and removes the collected timestamp state.
2. Smart-reverts the status based on where the order actually is:
   - A collection date is scheduled → **Collection Scheduled**
   - Sender has given dates but none scheduled → **Sender Availability Confirmed**
   - Otherwise → **Sender Availability Pending**
3. Clears loading/bay allocation so the bike stops showing as on a van or in a bay:
   - `loaded_onto_van` → false, `loaded_onto_van_at` → null
   - `held_by_driver_name` / `held_by_driver_at` → null
   - `storage_locations` → cleared
4. Shows a success toast and refreshes the order on screen. No emails are sent.

Not touched: Shipday jobs (staff can re-sync if needed), collection photos, receiver delivery dates already given.

## Technical changes
- `src/services/orderService.ts`: new `markOrderNotCollected(id)` that updates the order as above and returns the mapped order (mirrors `markOrderCollected`). Status chosen from `scheduled_pickup_date` and sender availability dates on the current row.
- `src/pages/OrderDetail.tsx`: new `handleMarkNotCollected` handler with confirm dialog ("Mark this bike as not collected? This will clear its van/bay allocation."), wired to the header; existing "Mark as collected" button keeps working and re-appears afterwards.
- `src/components/order-detail/OrderHeader.tsx`: render the new button (PackageX icon, secondary/outline style) when `orderCollected` is true and status isn't `cancelled`/`delivered`; hide "Mark as collected" in that case (already the behaviour).

## Verification
- Typecheck passes.
- Order detail: collected order shows the new button; after clicking, status reverts appropriately, van/bay cleared, and "Mark as collected" is offered again.
