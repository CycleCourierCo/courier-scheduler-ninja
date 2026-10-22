# Compare generated routes with the routes actually sent out

## Goal
Show, for each day, how far the routes sent to drivers ended up from what Generate Routes suggested, and which kinds of edits you keep making, so the planner rules can be fixed where they're actually wrong.

## Step 1 — One-off analysis (done first, read-only)
- Match each saved generated plan (date, van, stop order) with the timeslips and Shipday routes actually sent for that date.
- For each day, report:
  - Jobs the optimiser planned but you removed, and jobs you added that it didn't plan
  - Jobs moved to a different van
  - How much the order changed (stops moved up or down)
  - Planned vs actual stops, hours and miles per van
  - Number of vans planned vs actually sent
- Group the edits into likely reasons, for example: London mixed into other routes, same-address stops split up, business opening hours, difficult areas, guaranteed jobs, routes that were too thin or too long.
- I'll send you a written summary with the top 3–5 patterns and the rule change each one points to.

## Step 2 — Ongoing "Plan vs Actual" view (optional, after you've seen Step 1)
- New tab in Job Scheduling with a weekly list: match %, jobs added/removed, van changes, and mileage difference per day, plus a side-by-side map for each van.

## Limits
- This only works for days where a route was generated and saved. Days planned by hand can't be compared.
- "Actual" means the route that was sent out, not the driver's GPS trace.

## Technical details
- Sources: `route_plans` / `route_plan_routes` / `route_plan_stops` against `timeslips` (job sequence, vehicle) for the same date, matched by order ID and leg type.
- Order similarity: share of stops kept, plus how far stops moved in the order (Kendall tau distance) per van.
- Step 1 uses read-only queries only. Step 2 adds a page reading the same tables, with no changes to the optimiser.
