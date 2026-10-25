# Planned routes on the Live Van Map

Yes, this is possible, with one limit. Radius only tells us where each van is right now; the Radius docs you sent have no "where was it earlier" option. To compare a whole day's driving against the plan, the app has to start recording van positions itself. Days before recording starts can't be shown.

## What you'll see
- A **date picker** on the Live Van Map, set to today by default.
- For the chosen date, each van's planned route from its timeslip: numbered stops (collections and deliveries) joined by a line in the van's colour.
- The **actual path** the van drove, drawn as a second line, using the positions the app recorded that day.
- **Stops visited:** each stop turns green if the van came within 150 m of it that day, and shows the time it got there. Stops the van never reached stay red.
- **Off-route alerts:** stretches where the van was more than 2 km from the planned line for over 10 minutes are highlighted, with times. For today, a van that's off-route right now gets a badge in the list.
- A summary for each van: stops visited out of total, number of off-route stretches, and planned miles against recorded miles.
- A "Show van" filter, so you can look at one route at a time.

## Recording positions
- Every 2 minutes, the app saves each van's position (between 5am and 10pm London time).
- Records are kept for 90 days, then deleted, because they're driver location data.
- Only admins and fleet managers can see them.

## Not included
- Turn-by-turn road-following lines: the planned route is drawn as straight lines between stops, in the planned order.
- Days before recording begins.
- Sending alerts by email or text when a van goes off-route (can add later).

## Technical details
- New table `fleet_position_history` (vehicle_id nullable, registration, lat, lon, speed, ignition, recorded_at), staff-only RLS via `is_fleet_staff`, with an index on (registration, recorded_at). A daily purge deletes rows older than 90 days.
- `radius-positions` gets a `record` cron action (X-Cron-Secret) that runs every 2 minutes and inserts trimmed rows, matched to vehicles by normalised registration.
- New `fleet_route_day(p_date)` security-definer RPC (fleet staff only) that returns timeslips for the date (vehicle, driver, job_locations in planned order), so planners' data isn't exposed through broader policies.
- `src/lib/fleet/routeDeviation.ts`: functions to check whether a stop was visited (haversine within 150 m, first time), measure distance to the planned line (point-to-segment), and find off-route stretches (above 2 km for at least 10 minutes). Vitest tests for each rule.
- LiveMap: add a date state, Polyline layers for planned and actual paths, numbered stop markers, and a per-van summary in the list. Live positions still refresh every 60 seconds for today.
- These values are saved to memory: 150 m visit radius, 2 km / 10 min off-route threshold, 90-day retention.
