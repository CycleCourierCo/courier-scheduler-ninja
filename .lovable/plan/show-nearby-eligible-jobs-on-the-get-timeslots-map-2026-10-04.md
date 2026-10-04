# Show nearby eligible jobs on the Get Timeslots map

## What you'll see
- On the route map in the Get Timeslots window, extra faded pins show jobs that aren't on the route yet but could be done on the route's date and are close to it.
- A small control above the map lets you pick how close: 2, 5 (default), 10 or 20 miles from any stop on the route. A switch turns the extra pins on or off.
- Different pin styles for nearby collections and nearby deliveries, so they're easy to tell apart from the numbered route stops.

## Which jobs show
- **Collections:** customer has given this date, and the bike isn't collected yet.
- **Deliveries:** customer has given this date, the bike is already collected, and any inspection needed is finished (inspected or repaired).
- Jobs already on the route, cancelled/delivered jobs, and jobs already booked on another date are left out.

## Adding a job
- Click a pin to see the customer, collection or delivery, address, tracking number and how far it is from the route.
- An **Add to route** button puts it at the end of the job list, and the timeslots are worked out again, same as adding it any other way. You can then drag it or press Re-optimise.
- The pin then turns into a numbered stop.

## Technical details
- Reuse `isLegViableOnDate` from `heatJobPoints.ts` (collection/delivery/inspection rules) against the order list RouteBuilder already loads, using the selected route date.
- Use the leg's chosen location (home/work/alt via `getLegContact`) for coordinates; skip jobs without coordinates.
- Distance = straight-line (haversine) to the nearest route stop or depot; filter by the chosen radius.
- `TimeslotRouteMap` gets new props `candidates` and `onAddCandidate`; RouteBuilder passes its existing add-job handler (same one the job list uses), which recalculates timeslots.
- Works in both the wide window and the phone layout.
