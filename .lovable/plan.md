## Goal

Once a route is created (or already exists) for the selected date, surface it in the left sidebar under the unassigned stops list, draw each route as a polyline on the map starting and ending at the Lawden Road depot (B10 0AD), and show summary stats (distance, time, number of stops).

## Changes — `src/pages/DispatchRoutesPage.tsx`

1. Import `DEPOT_LOCATION` from `src/constants/depot.ts`.
2. Replace the `routesForDate` query to also fetch each route's stops (id, sequence, stop_type, lat, lon, address, order_id) plus `total_distance_km` / `total_duration_min`. Order stops by sequence.
3. Pass the depot as `origin` to the existing `optimise-route` invocation so new routes are optimised starting from B10 0AD. Persist the depot stats in `total_distance_km` / `total_duration_min` (already done by the function once origin is provided).
4. Sidebar layout: keep the unassigned stops scroll list at the top, then add a "Routes on {date}" section below it (within the same Card, separated by a divider). Each route card shows:
   - Route name + driver (if assigned)
   - Distance (km), duration (min, formatted hh:mm), stop count
   - Collapsible list of stops in sequence (Depot → stops → Depot)
   - A small toggle/eye button to show/hide that route's polyline on the map (default: all visible)
5. Map polylines:
   - Add a `routePolylinesRef` map (route_id → google.maps.Polyline) plus matching depot markers.
   - For each visible saved route, build a path `[depot, ...stops sorted by sequence, depot]` and render a polyline. Use a distinct colour per route (cycle through a small palette) so multiple routes stay distinguishable from the in-progress optimised polyline (which stays indigo).
   - Add two small depot markers (start + end overlap; render one black "B10 0AD" marker) when at least one saved route is visible.
   - Clean up polylines/markers on unmount and when routes change.
6. Fit-bounds tweak: include depot + all route stops when computing bounds so saved routes are visible even before any unassigned pins exist.
7. Leave the existing "Create route", "Add to route", optimise, and selection flows unchanged in behaviour — only the optimise call gains the depot origin.

## Technical notes

- No database/schema changes. `dispatch_routes` already stores `total_distance_km` and `total_duration_min`; `dispatch_route_stops` already stores `lat`, `lon`, `sequence`, `stop_type`, `address`.
- Depot constants: `lat: 52.4690197, lon: -1.8757663`, label "Depot · B10 0AD".
- Duration formatting helper: `${Math.floor(min/60)}h ${Math.round(min%60)}m` (fallback to "—" when null).
- Polyline colours: cycle `["#6366f1","#0ea5e9","#10b981","#f97316","#ec4899","#a855f7"]`.
- No new dependencies.
