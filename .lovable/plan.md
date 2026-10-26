# Bikes in van on Live Map stops

## What you'll see
- Each stop in "Stops & live ETAs" and each stop marker popup shows a badge such as "🚲 4/6": bikes on the van after that stop, out of van capacity.
- The route card header shows "Leaves depot with X" and the peak load, with a red overload warning if the peak is over capacity.
- Badge turns red when the load goes over capacity, as it does in Route Builder.

## Counting rule (same as when sending timeslots in Route Builder)
- Starting load = van spaces of every delivery on the route whose collection is not also on the same route.
- After each collection add that order's van spaces; after each delivery subtract them.
- Spaces come from bike type (same bike-type space settings and van capacity used in Route Builder), not simply the number of bikes.
- Breaks don't change the count. Collected/delivered status doesn't change the planned count.

## Technical details
- Pull the counting out of RouteBuilder into a shared helper in `src/lib/bikeSpaces.ts` (`computeVanLoads(stops, orderById, spaceMap)` returning starting load, load after each stop and peak), and make Route Builder use it so the two can't drift.
- RouteOverlay already loads the route's orders; extend that query with the bikes/bike type fields and attach `loadAfter` to each `RouteStop`.
- LiveMap uses `useBikeSpaces()` for capacity and renders the badge in the stop list, marker popup and route card.
- Add `bikeSpaces.test.ts` cases: delivery without matching collection counts at start; collection then delivery on same route nets out; peak load detected.
