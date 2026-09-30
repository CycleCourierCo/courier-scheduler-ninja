# Re-optimise button on the Route Timeslots popup

## What you get
A new **Re-optimise** button next to Recalculate / Flip Route in the Route Timeslots popup. It takes only the stops already in the route and asks the route optimiser for the most efficient order, then recalculates the timeslots as normal. No stops are added or dropped.

## Constraints respected
- Start time and date chosen in the popup; start and finish at the depot.
- Van bike-space capacity, including the starting load.
- A bike's collection always comes before its delivery when both are on the route.
- Business opening hours / time windows where we have them.
- Driver breaks stay in the route (placed at roughly the same point in the day).
- Route-hour limit used by the planner.

## Behaviour
- Shows "Optimising..." while running; the new order replaces the current one and the timeslots/map refresh.
- Toast shows the change, e.g. "Saved 18 min / 12 miles".
- If the optimiser cannot fit every stop within the constraints, the order is not changed and a message lists the stops that would not fit, so you can decide.
- An **Undo** option on the toast restores the previous order.
- Disabled with fewer than 3 stops.
- Available to the same people who can use the Route Builder today.

## Technical details
- Add a `mode: "reorder"` path to the existing `route-optimize` edge function (same VROOM/Verso endpoint and auth). Input: date, shift start, van capacity, starting load, ordered stops (orderId, leg type, coordinates, bike spaces, time window), break positions. Builds one vehicle and VROOM `shipments` for collection+delivery pairs and `jobs` for single legs; returns the ordered stop keys, unassigned keys, and duration/distance before vs after. Input validated with Zod; no personal details logged.
- In `RouteBuilder.tsx`, add `handleReoptimise` beside `handleFlipRoute`: calls the function, rebuilds `selectedJobs` in the returned order (re-inserting breaks), then runs `calculateTimeslots`. Keeps previous order for Undo.
- Address overrides (work address / neighbour) reuse the existing coordinates on each stop.
