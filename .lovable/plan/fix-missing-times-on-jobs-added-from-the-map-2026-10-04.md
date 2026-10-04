# Fix missing times on jobs added from the map

## Cause
Pressing "Add to route" on a map pin puts the job at the bottom of the list but never works the route times out again, so the new job has no time (and no WA button, since that needs a time).

## Fix
- When a job is added from the map, add it to the list and straight away work out the times again for the whole route (same as Re-optimise, removing jobs, etc.), so the new job gets its time and later stops update.
- "Updating times…" shows while it's working.
- Jobs already on the list that lost their time will get it back as soon as you add/move anything or press Recalculate.

## Technical details
- `RouteBuilder.tsx`: add an `addJobFromMap(order, type)` handler that builds the new stop (same shape as `toggleJobSelection`), skips if already on the route, then `setSelectedJobs(next)` and `calculateTimeslots(next)`.
- Pass `addJobFromMap` as `onAddCandidate` to both the wide and phone `TimeslotRouteMap` (the top guaranteed panel keeps using `toggleGuaranteedJob`).
