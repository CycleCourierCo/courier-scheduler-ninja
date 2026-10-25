# Saved routes → timeslips, road lines on the live map, planned vs completed report

## Why today's routes don't show
The map reads timeslips, and the newest ones are from 22 Oct. Your saved routes (from Load Route) are stored separately. Their date is only in the name ("2026-10-26 — 8ba36398"), and they don't say which van or driver ran them. There are 4 saved routes for today.

## 1. Link each timeslip to a saved route
- Creating or editing a timeslip gets a required **Saved route** dropdown. It lists saved routes for the timeslip's date and hides ones already used by another timeslip.
- The app suggests a match when a saved route has the same jobs as the timeslip.
- Older timeslips without a link still work and are labelled "No saved route".

## 2. Live map uses the linked saved route
- For the chosen date, each linked saved route is drawn **along the roads**, using the same Google Maps road routing as the Route Builder map, one colour per van.
- The van and driver come from the linked timeslip, so the recorded driving path and stop checks (reached within 150 m, off-route more than 2 km for 10+ minutes) compare against the road line.
- Saved routes not yet linked still appear as a planned line marked "No timeslip yet". This means today's 4 routes show up straight away.

## 3. Planned vs completed report
A new **Route report** page (Fleet / Scheduling), opened per day or from a timeslip:

| | Planned (saved route) | Completed (timeslip) |
|---|---|---|
| Stops | count, collections/deliveries | stops done, missed, extra |
| Order of stops | planned sequence | actual sequence (from tracking when available) |
| Times | start time, estimated time per stop | actual arrival per stop, lateness |
| Miles | planned road miles | timeslip miles (+ tracked miles) |
| Hours | planned duration | timeslip hours |

- Each stop row shows whether it was done, missed or added, its planned time, its actual time, and the difference.
- Day summary across all vans, plus a CSV download.
- Actual arrival times need tracking for that day. Before tracking existed, the report uses only timeslip data.

## Technical details
- Migration: add `timeslips.saved_route_id uuid references saved_routes(id) on delete set null`, with a unique partial index so one saved route maps to one timeslip. Store a frozen planned summary on the timeslip (`planned_snapshot jsonb`: stops, start_time, planned miles/duration) when linked, so later edits to the saved route don't change the report.
- RPC `fleet_route_day(date)` extended to return the saved routes for the date (name prefix) LEFT JOINed to the timeslips, vehicle and driver. Staff-only, security definer.
- `RouteOverlay.tsx`: `useRoadPaths` calls the `route-path` function in chunks of 25 or fewer stops, decodes the polyline (reusing the decoder from `TimeslotRouteMap`), and caches with React Query by route id + stop hash. If routing fails it falls back to straight lines with a note.
- `routeDeviation.ts` measures against the road polyline. New `src/lib/fleet/routeReport.ts` compares planned and completed stops by orderId+type. Tests cover matched/missed/extra stops, lateness, and miles difference.
- Timeslip form validation requires the saved route on new timeslips. AGENTS.md rule: planned-vs-actual reads the frozen snapshot on the timeslip.
- Google cost: about one routing call per route per day (cached).
