# Daily greedy route planning

Add a second planning mode to Generate Routes: instead of balancing work across
the whole horizon, it fills each day as full as it can, one day at a time, in
order. Both modes sit side by side so you can pick the better one.

## What you'll see

Two tabs at the top of the Generate Routes popup:

- **Balanced (all days together)** — today's planner, unchanged.
- **Daily (greedy)** — plans day by day: the first chosen day is packed as full
  as the vans allow, then the next day gets what's left, and so on.

Both tabs use the same day picker, van availability grid, shift start and
inspection settings, so you set things up once and can run either.

### Comparison strip

Above the day tabs, a small strip compares the two once both have been run:

- Days planned, total stops, jobs, vans used
- Total miles and hours
- Jobs left unplanned
- For admins: total cost and profit, and the difference between the two modes

Each mode keeps its own day summary and costings panel (the one already there).

### Using a greedy day

Fully usable, same as the balanced plan: lock a day, pick a route, and hand off
to Get Timeslots. Locking is per mode+day — locking a greedy day reserves those
jobs, and the other mode is then marked stale so you re-run it before locking
anything there, preventing the same job being committed twice.

## Notes on behaviour

- Greedy is faster and gives fuller early days; it can leave later days thin and
  is more likely to miss a guaranteed date near the end of the horizon. The
  trade-off is shown in plain words on the comparison strip.
- Guaranteed dates stay hard constraints in both modes; expired/awaiting-dates
  legs are excluded from both.
- Collect-then-deliver still applies: a delivery can only be planned on or after
  the day its collection lands.

## Technical detail

- `route-optimize` gains `mode: "joint" | "greedy"` (default `joint`, so nothing
  changes for existing callers). In greedy mode the function loops the chosen
  dates in order, solving one day at a time with only that day's van-day
  vehicles, and passes jobs already assigned on earlier days out of the pool.
  Each day's solve maximises assigned jobs (job priority kept, no fleet-size
  fixed cost so all available vans are offered), then deliveries unlocked by that
  day's collections are added to the remaining days' pools.
- Response shape is unchanged (`RoutePlanResult`), plus `mode` on the plan and an
  `unplanned_count` per day, so the existing day tabs, route cards, map,
  `DaySummary`, at-risk and needs-new-dates panels all work as-is.
- `route_plans.mode` column (text, default `joint`) added so a plan records how it
  was made; `is_stale` is set on the other mode's active plan when a day is
  locked.
- `routeGenerationService.ts`: `GenerateRoutesInput` gains `mode`; add
  `comparePlans(a, b)` returning the strip's figures from data already in
  `RoutePlanResult`.
- `GenerateRoutesDialog.tsx`: wrap the results area in `Tabs`, hold two plan
  results in state, share the setup controls, and render a new
  `generate/PlanComparison.tsx` above the day tabs. No changes to locking,
  route selection or the Get Timeslots handoff beyond passing the active mode.
