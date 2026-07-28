## Goal

Some orders were created before Northern Ireland detection existed, or the address region wasn't picked up. Admins need a way to flag an existing order as an NI delivery so it enters the Foam My Bike pipeline, gets the £120/bike surcharge, and has its delivery job re-routed to City Air Express.

## What gets built

A new admin-only card on the order detail page (`/orders/:id`), placed next to the existing Admin Tracking Editor section.

**When the order is NOT flagged as NI:**
- Shows a "Mark as Northern Ireland delivery" button.
- Clicking opens a confirmation dialog explaining exactly what will happen (foam pipeline starts, delivery diverts to City Air Express in Manchester, £120/bike surcharge applies to future invoicing).
- If a BT postcode is detected on the receiver address but the flag is off, the card shows a hint: "This looks like a Northern Ireland address."

**When the order IS flagged as NI:**
- Shows a green "Northern Ireland delivery" badge, the current foam stage, and the City Air Express hand-off address.
- Shows an "Undo / unmark" button (same confirmation pattern) that clears the flag and the foam pipeline, and restores the delivery job to the real receiver address.

## What the button does

On confirm:
1. Update the order: `is_northern_ireland = true`, `destination_region = 'Northern Ireland'`, `foam_status = 'pending_collection'`, `foam_pending_collection_at = now()`.
2. Re-route the Shipday delivery leg:
   - If the order has an existing `shipday_delivery_id`, delete that delivery job via the existing `delete-shipday-order` function.
   - Re-create the delivery job via the existing `create-shipday-order` function, which already diverts NI deliveries to City Air Express and writes the NI receiver block into the delivery instructions.
   - The collection/pickup job is left untouched.
3. Toast the result and refresh the order.

Unmarking reverses all of the above (clears flags/timestamps, recreates the delivery job against the real receiver address).

## Safety rails

- Admin-only (uses the same `isAdmin` check already on the page).
- The confirmation dialog warns explicitly when a delivery job is already assigned to a driver or already scheduled, since re-creating the job will drop the driver assignment and the timeslot — the planner will need to re-schedule that delivery.
- Blocked entirely if the order is already `delivered`, `delivered_by_3p`, or `cancelled`.
- Shipday re-routing failures do not roll back the flag; they surface as an error toast telling the admin to re-create the delivery job manually from scheduling.

## Technical notes

- New component `src/components/order-detail/NorthernIrelandEditor.tsx`, rendered from `src/pages/OrderDetail.tsx` inside the existing `isAdmin` block near `AdminTrackingEditor`.
- Reuses `isNorthernIrelandAddress` from `src/utils/northernIreland.ts` for the BT-postcode hint and `CITY_AIR_EXPRESS` from `src/constants/depot.ts` for display.
- Shipday work reuses `src/services/shipdayService.ts` (`delete-shipday-order` / `create-shipday-order`); no new edge functions and no database migration are needed — every column involved already exists on `orders`.
- The QuickBooks £120/bike surcharge needs no change: `create-quickbooks-invoice` already reads `is_northern_ireland` at invoice time.
