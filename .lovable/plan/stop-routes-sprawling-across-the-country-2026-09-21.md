# Stop routes sprawling across the country

Skegness with Newcastle, or Nottingham with London and Exeter, on one van is the
planner doing exactly what it was last told: fill as few vans as possible.

## Why it happens

Each van is charged a whole shift the moment it is used (£132 for a 12-hour day)
plus £11 per hour, and nothing at all for the miles it covers. So adding a
200-mile detour to a van already out is nearly free, while opening a second van
costs £132. There is also nothing in the model that says a day's stops should
be near each other — only time limits (12h/15h, with a travel-time ceiling).

## The fix

1. **Charge for distance, not just time.** Every mile a van covers costs money,
   so a long detour stops looking free. Where Verso won't take a per-mile cost,
   the same effect is achieved by cutting the per-shift charge right down and
   raising the hourly rate, so driving time is what dominates the choice.
2. **Give each van a region for the day.** Before solving, the day's stops are
   grouped by area (clustered around the depot by compass direction and
   distance), and each van is allowed only one region's work. A van can then no
   longer take Skegness and Newcastle, or Nottingham and Exeter, on one day.
   Far-flung areas (Cornwall, Kent, the north east) become their own regions,
   which is exactly what the long "expedition" day is for.
3. **Cap how far a route can spread.** A route is rejected if its stops span
   more than a set distance apart (default ~120 miles, higher on a long day),
   so even inside one region a route stays workable.
4. **Show it.** Each route card names the area it covers ("North East",
   "East Midlands") and shows its spread, so a silly route is obvious at a
   glance rather than only on the map.
5. Anything that can't be placed under these rules lands in the existing
   at-risk / leftover list instead of being bolted onto a distant route.

## Technical detail

`supabase/functions/route-optimize/index.ts`
- Add distance costing: try `costs.per_km` (or Verso's equivalent) on each
  vehicle; on a 400 rejection fall back to `fixed = 1 * DRIVER_PENCE_PER_HOUR`
  (one hour, not a whole shift) with `per_hour` unchanged, so the solver stops
  hoarding stops onto one van. Keep the existing expedition premium multiplier.
- New `regionFor(leg)`: bearing + distance band from `DEPOT` → region key
  (e.g. `NE-far`, `EM-near`, `SW-far`), with the five difficult areas mapped to
  their own far regions.
- `buildVehicles`: per date, count legs per region, allocate vans to regions in
  proportion to the work, and tag each vehicle with a region skill
  (`skills: [regionSkillId]`, difficult keeps skill `1` alongside). `buildJob`
  gains the matching region skill so a job can only go to a van in its region.
  Long-day vans are allocated to far regions first.
- Post-solve: compute each route's max pairwise stop distance; if it exceeds
  `MAX_SPREAD_MI` (120 normal / 220 long day), drop the furthest stops back into
  unassigned and re-time the route. Return `region` and `spread_mi` per route.
- Apply the same region skills in the grace/expiring pass and the greedy branch.

`src/services/routeGenerationService.ts` — `PlanRoute` gains `region?: string`
and `spread_mi?: number`.

`src/components/scheduling/generate/GenerateRoutesDialog.tsx` — show the region
name and spread on each route card.

No schema, eligibility, date or pricing changes.
