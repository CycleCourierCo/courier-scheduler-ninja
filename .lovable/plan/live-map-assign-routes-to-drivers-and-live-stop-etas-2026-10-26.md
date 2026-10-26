# Live Map: assign routes to drivers and live stop ETAs

## What you'll get
1. **Assign a van to each saved route** (Live Map route card): an "Assign van" dropdown of active vans. The route links automatically to that van's timeslip for the date, and the driver comes from the timeslip. If there's no timeslip yet, the assignment is saved and links when one is created for that van and date. One van per route per day; reassigning moves the link. Timeslip route picking still works and stays in sync.
2. **Live ETA on "No tracking yet" stops**: once a route has a driver, every stop not yet visited shows an ETA (e.g. "ETA 11:42 · 14 mi") worked out from the driver's current position, instead of "No tracking yet".
3. **ETA rule**: drive time along the road from the driver's position through each remaining stop in order, **plus 15 minutes for every stop before it**. Example: stop 3 = drive to stops 1, 2, 3 + 30 min (two earlier stops).
4. **Shareable link per stop**: a "Send ETA" button on each stop opens the same WhatsApp/email send dialog as today (pre-filled with that stop's contact), with a copy-link option.
5. **Uber-style tracking page** for each link: full-screen map with the van icon moving along the road line to the customer's pin, a bottom card with big ETA time, "X stops before you", minutes away, driver first name and van, refreshing every 2 minutes. Shows "Delivered/Collected" once the stop is visited, and expires at end of day.

## Position source
The van's Radius tracker position only, found through the van on the driver's timeslip for that day. If the Radius position is more than 15 minutes old, the stop shows "Van position unavailable" and no link can be sent.

## Privacy
Public page shows only the van location, the line to that customer, ETA and driver first name — no other customers' addresses or stops. Link only works for its own stop.

## Technical details
- Migration: `saved_route_assignments` (saved_route_id, route_date, vehicle_id, assigned_by; unique per route+date) with fleet staff + route planner RLS and grants. A trigger on assignment and on timeslip insert/update sets `timeslips.saved_route_id` where `vehicle_id` + `date` match, so the existing planned snapshot freezes as before.
- Extend `fleet_eta_links` with `saved_route_id`, `stop_index`, `driver_id`, `order_id` (nullable; existing depot links unchanged).
- Extend `eta-link` Edge Function: `send` accepts stop target; `view` computes remaining-stop road route via Google Routes (waypoints in order), cumulative durations + 15 min × prior stops, returns only the target leg geometry; cached 2 min.
- Shared `computeStopEtas()` in `src/lib/fleet/stopEta.ts` with tests: 15-min-per-prior-stop rule, visited stops skipped, stale position returns none.
- Live Map list: per-stop ETA via one batched call per route (not per stop), refreshed every 2 minutes.
- New `/eta/:token` layout variant for stop links (full-screen map + bottom sheet).
