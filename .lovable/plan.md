# Live map: show saved routes, drawn along the roads

## Why today's routes don't show
The map currently reads route sheets (timeslips), and the newest ones are for 22 Oct. Your saved routes from Load Route are kept separately. The date is part of the route name ("2026-10-26 — 8ba36398"). There are **4 saved routes for today (25 Oct)** and 5 for tomorrow. None of them record which van ran them.

## What changes
1. **Read saved routes for the chosen date.** The map picks up every saved route whose name starts with that date and shows its stops in order (pickup/delivery, address, estimated time).
2. **Draw them along the roads.** Each route goes to the same Google Maps road routing the Route Builder map already uses, starting from the depot at the saved start time. The route is drawn as a road line, one colour per route. Results are cached so refreshing doesn't pay for Google again. If Google fails, the stops still show with a "road line unavailable" note.
3. **Link a route to a van.** Saved routes don't say which van ran them, so each route in the list gets a "Van" dropdown. The app suggests a van from that day's timeslip when one matches the same jobs. Once a route is linked to a van, the existing checks run against the road line: stops reached within 150 m, and off-route for more than 2 km for 10+ minutes. Routes with no van show the planned line only.
4. **Timeslips still count.** If a date has timeslips but no saved routes, those still show, also drawn along the roads.
5. **Empty state:** "No saved routes for this date."

## Technical details
- New security-definer RPC `fleet_saved_routes_day(p_date)` (fleet staff only) returning id, name, start_time and job_data where `name LIKE p_date || '%'`. Also returns the suggested vehicle_id from the timeslip whose job orderIds overlap most.
- New table `fleet_saved_route_vehicles(saved_route_id, vehicle_id, set_by, set_at)` storing the van link, with fleet-staff RLS. This keeps saved_routes itself unchanged.
- `RouteOverlay.tsx`: `useRoadPaths` calls the `route-path` function (Routes API via the gateway, sign-in required) in chunks of 25 or fewer stops and decodes the polyline with the decoder from `TimeslotRouteMap`. Cached with React Query keyed by route id + stop hash.
- `routeDeviation.ts`: `distanceToRoute`/`pathMiles` use the road polyline when available. Add a test that a point on the road line is not off-route.
- Google Maps costs: about one call per route per day. Rendering itself has no cost because the map stays on Leaflet.
