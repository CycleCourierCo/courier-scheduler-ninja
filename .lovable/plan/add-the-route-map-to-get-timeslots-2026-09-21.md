# Add the route map to Get Timeslots

## What will change

- Add a route map near the top of the **Route Timeslots** window, below the date/time controls and above the ordered job list.
- Show the depot as both the start and finish, with every collection and delivery plotted in the current stop order.
- Use numbered stop markers so each point on the map matches the numbered job below it.
- Distinguish collections, deliveries, and the depot visually, with each marker showing the customer, stop type, address, tracking number, and estimated arrival time when opened.
- Draw the actual driving route through the stops using the existing route-path service rather than straight lines.
- Automatically fit the map around the complete route.

## Behaviour

- Keep the map synchronized when jobs are reordered, moved to a numbered position, removed, flipped, or recalculated.
- Use the currently selected home/work/alternative location for each stop.
- Exclude breaks from map markers while preserving their effect on displayed times.
- Handle longer routes in bounded route segments if the mapping service’s waypoint limit is reached, then display those segments as one continuous route.
- If a road path cannot be loaded, retain all stop markers and show a clear map-only fallback without interrupting timeslot editing.
- Give the map a useful fixed height on desktop and a shorter responsive height in the mobile drawer, without shrinking the existing job details.

## Technical details

- Create a focused timeslot route-map component using the project’s existing Leaflet setup, bundled markers, depot coordinates, and encoded-polyline decoder.
- Invoke the existing authenticated `route-path` function for route geometry and ignore stale responses when the stop order changes quickly.
- Reuse the component in both the desktop dialog and mobile drawer so both layouts remain consistent.
- Verify map rendering, marker order, route updates, fallback behaviour, and desktop/mobile sizing.
