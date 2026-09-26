# Book a bike in for warehouse storage

Right now a booking always needs a receiver, and there's no way to say "keep it at your warehouse". This adds that option and links it to Warehouse Stock.

## How it will work
1. **Booking:** a new "Store at our warehouse" option on Create Order. When it's ticked, the receiver is our Birmingham depot, filled in automatically. The customer only enters collection details and bike details.
2. **Shipday:** only a collection job is created. There's no delivery job, because the bike stays with us.
3. **Emails:** the sender gets the normal collection availability request. No emails go to a receiver.
4. **Arrival:** when the driver marks it collected, the order shows as "Awaiting bay" on the loading screen.
5. **Automatically added to stock:** once staff allocate a bay on the loading screen, a Warehouse Stock item is created for the booking customer. It copies the bike brand, model, type, value, frame size and bay, and links back to the order. The order is then marked "Stored at warehouse" and complete.
6. **Later dispatch:** the customer books it out from My Stock as today, which creates a separate delivery order already marked collected.

## Changes
- Create Order: storage option, depot receiver pre-fill, receiver section hidden.
- Order record: a "for storage" flag, and a "Stored" label on order and tracking pages.
- Shipday sync: skip the delivery leg for storage orders.
- Loading screen: bay allocation on a storage order creates the stock item (no duplicates if the bay is changed later; the stock item's bay is updated instead).
- Emails: skip receiver emails for storage orders.

## Technical notes
- Migration: `orders.is_warehouse_storage boolean default false`, `warehouse_stock.source_order_id uuid` (unique, nullable).
- Stock creation via a SECURITY DEFINER function `create_stock_from_storage_order(order_id)`, called after allocation; upserts on `source_order_id`, runs as staff only.
- `sync-order-shipday` / `create-shipday-order` / backfill: treat `is_warehouse_storage` as pickup-only (same as Box My Bike).
- Receiver email senders and availability expiry skip storage orders.
