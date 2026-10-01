# Route builder: protect on-route jobs and pair-aware splitting

## What you flagged

- **Remove not collected:** today a delivery is removed whenever the order's "collected" flag isn't set. A job that is on route (driver on the way to collect, or collecting as part of the route) hasn't got that flag yet — so its delivery **would** be removed. That's wrong.
- **Split route:** the split only keeps stops at the same address together. A collection and delivery for the same order at different addresses can end up on different vans.

## Changes

### 1. Remove not collected — keep on-route jobs
In `RouteBuilder.tsx`, `isUncollectedDelivery` also keeps a delivery when the order's status shows the collection is under way or done:
- `driver_to_collection`, `collection_scheduled`, `collected`, `driver_to_delivery`, `shipped`
- Scotland/ferry in-transit statuses (`in_transit_to_scotland`, `at_scotland_depot`, `awaiting_trunk_to_depot`, `in_transit_to_depot`, `collected_from_partner` handling already elsewhere)
- Depot/3PL statuses where the bike is already in our hands (`awaiting_depot`, `in_depot_awaiting_boxing`, `boxed_awaiting_label`, `awaiting_3p_collection`, `collected_by_3p`, `delivered_by_3p`)

Only deliveries where the collection hasn't started (status like `scheduled`/`pending` and not collected) are removed. The button count updates to match.

### 2. Split route — keep each order's collection and delivery on the same van
In the `route-optimize` edge function's `split` mode:
- Group stops by order: an order's collection and delivery become one linked pair (VROOM shipment) so the optimiser must place both on the same vehicle, collection first.
- Same-address clustering stays as-is.
- Everything else (balanced stop counts per van, baseline cost comparison, unassigned list) is unchanged.

## Technical notes
- Frontend-only change for the filter (`src/components/scheduling/RouteBuilder.tsx`).
- Split change is in `supabase/functions/route-optimize/index.ts`, `split` mode only — reorder and full generation are untouched.
- No database changes.
