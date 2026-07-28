## Problem

For Northern Ireland orders, the delivery stop shows the Manchester ferry hand-off address, but the arrival times in the Route Timeslots drawer are computed from the customer's Northern Ireland coordinates (your screenshot: 22:20 and 00:10 for two stops at the same Manchester address — those gaps match Birmingham→Derry and Belfast→Derry drive times, not Manchester).

Confirmed from reads:
- Both NI orders in the database (`CCC754212916013STEBT9`, `CCC754877137960COLBT4`) are flagged `is_northern_ireland = true`, and their `receiver.address` coordinates are the NI ones (54.57/-5.95 and 55.05/-7.26).
- `src/constants/depot.ts` holds the correct ferry coordinates (53.4713, -2.3049).
- `RouteBuilder.refreshAndCalculateTimeslots` (the function that runs when you press "Get Timeslots") overwrites every job's `lat`/`lon` with `receiver.address.lat/lon` straight from the database, with no Northern Ireland check. That is the point where ferry coordinates get replaced by NI coordinates.
- The same raw-receiver pattern is used in a few other places (coordinate edit/save, timeslip mileage, saved-route writes), so a fix in one spot alone won't hold.
- Note: your screenshot shows the stop named "City Air Express", but current code names it "Ferry hand-off" — the published site is running an older build, so a republish is needed after this fix.

## Fix

1. **`src/components/scheduling/RouteBuilder.tsx` — `refreshAndCalculateTimeslots`**
   - Add `is_northern_ireland` to the `orders` select.
   - Build the refreshed stop through `getLegContact(freshOrder, job.type)` instead of reading `sender`/`receiver` directly, so NI delivery legs keep the ferry coordinates, name, phone and address.
   - Carry `is_northern_ireland` (and `foam_status`) into the merged `orderData` so downstream checks stay correct.

2. **Guard the remaining raw-coordinate paths in the same file**
   - `updateAvailableJobCoordinates`: block/ignore writing customer coordinates onto an NI delivery stop in the builder (the DB receiver record stays untouched).
   - `createTimeslip` and the saved-route write: derive stop coordinates and addresses from `getLegContact` so mileage, pay and the Google Maps link use the ferry point.

3. **Single source of truth**
   - Add a small `resolveStopCoords(order, type)` helper in `src/utils/niDelivery.ts` that returns ferry coordinates for NI delivery legs and customer coordinates otherwise, and use it everywhere the builder derives `lat`/`lon`, so any future path can't reintroduce the bug.

4. **Verify**
   - Load the two NI orders as delivery stops in the Route Builder, press Get Timeslots, and confirm each shows a Birmingham→Manchester travel time (roughly 1h30 for the first stop, ~0 min between the two Manchester stops), plus a "Ferry hand-off" label.

## Notes

- No database or edge function changes are required; the stored NI receiver address stays as the customer's real address (it's still shown as "Final destination" and used for the onward leg).
- After merging, the app needs republishing for the live domain to pick up both this fix and the earlier "Ferry hand-off" naming change.
