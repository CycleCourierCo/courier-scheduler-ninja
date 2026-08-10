# Auto-move Foam My Bike orders into "Pending foaming" on collection

## What's wrong

Foam My Bike (outbound Northern Ireland) orders are created at foam stage **Pending collection** and are only advanced by hand from the Foam My Bike page. Nothing moves them on when the driver collects the bike.

Confirmed for CCC754879463255ORBBT5: the order is collected (`status = collected`, collected flag set) but its foam stage is still `pending_collection` with no "pending foaming" timestamp. It is currently the only order stuck in that combination.

## The fix

Two automatic foam-stage transitions, applied in both places that record Shipday events — the live webhook and the reconciliation catch-up sweep:

1. **Collection → Pending foaming.** When a collection is recorded for a foam order still at `pending_collection`, move it to `pending_foaming` and stamp the time.
2. **Delivery to ferry partner → Delivered to ferry.** Both functions already set `foam_status = 'delivered_to_ferry'` when a Northern Ireland delivery leg completes, but neither stamps `foam_delivered_to_ferry_at`, so the stage change carries no timestamp. Add the timestamp (first time only), and only advance orders that are actually foam orders and not already past that stage.

Rules used:

- Only orders with a foam stage are touched; inbound Northern Ireland orders have no foam stage and are unaffected.
- Never moves an order backwards: an order already foamed, at the ferry, or delivered in NI is not pulled back to an earlier stage.
- Each stage timestamp is only set the first time, so repeat webhook events don't rewrite history.

Then a one-off data correction moves CCC754879463255ORBBT5 to **Pending foaming**, using its recorded collection time for the timestamp, so the Foam My Bike board reflects today's collection.

## Technical notes

- `supabase/functions/shipday-webhook/index.ts`:
  - In the block that sets `order_collected` for `collected` / `driver_to_delivery` / `delivery_scheduled`, add `foam_status = 'pending_foaming'` and `foam_pending_foaming_at = now` when the fetched order's `foam_status === 'pending_collection'`.
  - In the `delivered_to_ferry` block, guard the existing `foam_status` assignment so it only fires when the current stage is before `delivered_to_ferry`, and stamp `foam_delivered_to_ferry_at` when not already set.
  - Add `foam_pending_foaming_at` and `foam_delivered_to_ferry_at` to the two order selects at the top of the file so timestamps aren't overwritten.
- `supabase/functions/reconcile-shipday-orders/index.ts`: same two guarded assignments in the `newStatus === "collected" || newStatus === "driver_to_delivery"` and `newStatus === "delivered_to_ferry"` branches; add both timestamp columns to its select list and `DbOrder` type.
- Both functions redeploy automatically. No schema change — `pending_foaming` and `delivered_to_ferry` already exist in the `foam_status` enum, and both timestamp columns already exist.
- No UI changes: `FoamMyBikeSection` groups by `foam_status`, so bikes appear under the right stage on their own.

