# Stop markers: CCC number, completed state, and closing ETA links

## What you'll see
- **Job marker popup** on the Live Map shows the CCC tracking number (e.g. CCC754...) above the address, plus in the "Stops & live ETAs" list.
- **Numbered stops**: each stop marker shows its route order number (1, 2, 3...) inside the circle, matching the numbers in the stop list.
- **Van icon**: van positions on the Live Map (and the customer ETA page) use a proper van symbol instead of a plain pin, still coloured by route and grey when the position is old.
- **Completed stops**: once a bike is collected (collection stop) or delivered (delivery stop), the marker turns solid green with a tick, the popup says "Collected" / "Delivered" with the time, and the stop row in the list is ticked and greyed. This uses the order's real status, not just GPS, so it works even with no tracking.
- Completed stops are no longer counted in "X stops before yours" or in the 15-min-per-stop ETA for later stops.
- **ETA links switch off**: when a stop's bike has been collected/delivered, its live tracking link stops showing the van and instead shows "Your bike has been collected/delivered" with no map position. The "Send" button for that stop disappears.

## Technical details
- Load tracking_number, order_collected, order_delivered and collected/delivered timestamps for the route's order IDs (one batched query) in LiveMap/RouteOverlay; extend RouteStop with trackingNumber and completedAt.
- Marker colour/label: completedAt takes priority over GPS visitedAt.
- eta-link: in `route_etas` skip completed stops when building legs; in `view` look up the target order — if the matching leg is done, return `{ done: true, closed: true }` without position or route; also mark the link expired (expires_at = now) so it stays closed.
- EtaPage: render the closed/done card without the map.
- Add a test in stopEta.test.ts: a completed earlier stop adds no 15-minute wait.
