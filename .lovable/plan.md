# Auto-move Foam My Bike orders into "Pending foaming" on collection

## What's wrong

Foam My Bike (outbound Northern Ireland) orders are created at foam stage **Pending collection** and are only advanced by hand from the Foam My Bike page. Nothing moves them on when the driver collects the bike.

Confirmed for CCC754879463255ORBBT5: the order is collected (`status = collected`, collected flag set) but its foam stage is still `pending_collection` with no "pending foaming" timestamp. It is currently the only order stuck in that combination.

## The fix

Whenever a collection is recorded for an outbound Northern Ireland foam order, advance the foam stage to **Pending foaming** and stamp the moment it happened. Applied in both places that record collections:

- The Shipday webhook (live driver events: collection completed / proof of collection uploaded).
- The Shipday reconciliation job (the catch-up sweep for events the webhook missed).

Rules used:

- Only when the order is a foam order (has a foam stage) and that stage is still `pending_collection`.
- Never moves an order backwards: orders already foamed, at the ferry, or delivered are untouched.
- Inbound Northern Ireland orders have no foam stage, so they are unaffected.
- The "pending foaming" timestamp is only set the first time.

Then a one-off data correction moves CCC754879463255ORBBT5 to **Pending foaming**, using its recorded collection time for the timestamp, so the Foam My Bike board reflects today's collection.

## Technical notes

- `supabase/functions/shipday-webhook/index.ts`: in the block that already sets `order_collected` for `collected` / `driver_to_delivery` / `delivery_scheduled`, add `foam_status = 'pending_foaming'` plus `foam_pending_foaming_at = now` when the fetched order's `foam_status === 'pending_collection'`. The select at the top already includes `foam_status`; add `foam_pending_foaming_at` to it so the timestamp isn't overwritten on repeat events.
- `supabase/functions/reconcile-shipday-orders/index.ts`: same guarded assignment inside the existing `newStatus === "collected" || newStatus === "driver_to_delivery"` branch; add `foam_pending_foaming_at` to its select list too.
- Both functions redeploy automatically.
- Data fix: update the single order row's `foam_status` and `foam_pending_foaming_at` (no schema change; no new enum values — `pending_foaming` already exists in `foam_status`).
- No UI changes: `FoamMyBikeSection` already groups by `foam_status`, so the bike appears under Pending foaming on its own.
