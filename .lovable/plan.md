## Goal

On the Dispatch Routes page, in each saved route card:

1. Show a calculated timeslot (ETA window) next to each stop, using the same logic as the Job Scheduling Route Builder (cumulative travel time from depot + 15 min service per stop, rounded to the next 5 min).
2. Add a **Reoptimise** button on each route.

## Why timeslots aren't showing today

The current code reads `orders.pickup_timeslot` / `orders.delivery_timeslot`, but those columns are NULL for these orders — they only get populated when a user explicitly sends timeslots from the Job Scheduling page. So nothing renders.

The user wants the dispatch route to **compute** the timeslot the same way Job Scheduling does (see `RouteBuilder.calculateTimeslots` around line 1445): start from depot at a configurable start time, add Google travel time between consecutive stops, +15 min service per stop, round up to next 5 min, format as a 3-hour window (`formatTimeslotWindow`).

## 1. Per-stop ETA computation

### Edge function: extend `supabase/functions/route-path/index.ts`

It already calls `routes/directions/v2:computeRoutes` for the polyline. Add `legs.duration` to the field mask and return an additional array `legDurationsSec: number[]` (length = `intermediates.length + 1`, one per leg between consecutive waypoints including depot→first and last→depot).

No other behaviour changes.

### Frontend: `src/pages/DispatchRoutesPage.tsx`

- Add a small `startTime` state (default `"08:00"`) with a tiny `<Input type="time">` in the "Routes on {date}" header so the planner can change the depot departure time (mirrors Job Scheduling's `startTime`).
- In the same `useEffect` that already fetches the polyline per saved route, also read `legDurationsSec` from the response and store it in `routePathCacheRef.current[routeId]` alongside the existing `path`.
- Build a derived `etaByStop: Record<routeId, Record<sequence, string>>` in render: start from `startTime`, for each stop `i` add `legDurationsSec[i]` seconds, round up to the next 5 min → that's the arrival time; then add 15 min service before moving on. Use the same `roundTimeToNext5Minutes` helper logic inline.
- In the stop list rendering (current lines 905–922), replace the existing `s.timeslot` lookup with the computed ETA:
  - If we have a computed ETA, show `formatTimeslotWindow(eta)` (e.g. `08:23 to 11:23`) as a muted suffix.
  - If the cache hasn't loaded yet for that route, show nothing (or `…`).
- Drop the now-unused `orders` timeslot join from `routesForDate` to keep the query lean.

This keeps the math 100% client-side and consistent with Job Scheduling.

## 2. Reoptimise button

In the route card header (lines 869–890), add a third icon button (e.g. `RefreshCw`) between Rename and Delete with a confirmation `AlertDialog` ("Reoptimise this route? Stop order will change.").

Handler `handleReoptimiseRoute(route)`:

1. Build `stops` payload from `route.stops` → `{ id: stop.id, lat, lon }` (filter missing coords; require ≥2).
2. `supabase.functions.invoke('optimise-route', { body: { stops } })` — same edge function the page already uses for new routes.
3. On success, update `dispatch_route_stops.sequence` for each returned `stop_id` (batch `upsert` or per-row `update`), and `dispatch_routes` with `total_distance_km`, `total_duration_min`, `optimised_at: now()`.
4. Clear `routePathCacheRef.current[routeId]` so the polyline + ETAs refetch with the new order, and invalidate `["dispatch-routes-for-date", routeDate]`.
5. Toast success/failure. Use existing `routeMutating` state to disable buttons.

RLS already permits these updates for admin/route_planner.

## Out of scope

- No DB schema changes.
- No changes to `optimise-route` itself.
- No changes to map rendering beyond the existing per-route refresh path.
- No writing of the computed ETA back to `orders.pickup_timeslot` / `delivery_timeslot` — this stays a display-only calculation, same as the Route Builder preview before the user explicitly sends it.
