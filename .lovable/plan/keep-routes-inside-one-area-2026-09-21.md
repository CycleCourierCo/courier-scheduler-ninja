# Keep routes inside one area

## The problem

The planner has no rule that a single route must stay in one part of the country. The optimiser is only told what each job costs in driving time and miles, so when it is pushed to fit everything in (which is what the last change did), it happily bolts Peterborough, Milton Keynes, Brighton and Winchester onto a London run. Nothing in the plan says "a London van does London".

The "difficult area" idea (London is one of these) currently only decides which van gets a 15-hour day — it does not stop other work being added to that same van.

## What I'll change

- **Give each van an area for the day.** Before planning, the day's work is grouped geographically: each difficult area (London, and any other drawn area) becomes its own group, and the remaining work is grouped into regions around the depot, each region kept within a sensible driving radius of its own centre.
- **A route can only serve its own area.** A van assigned to London can only take London jobs, so a London route is all London. No more Brighton-plus-Peterborough runs.
- **The on-route exception you asked for.** A job outside the area is allowed on that van only if it genuinely sits on the way — within a short distance of the straight line between the depot and the area being worked. Collections and deliveries that fall in that corridor can be picked up en route; anything off the corridor cannot.
- **Vans are shared out by workload.** Each area gets vans in proportion to the jobs and bike spaces it needs, with at least one van where there is work. Areas with leftover work get any spare van next, rather than work being bolted onto a distant route.
- **Anything that still can't fit is reported, not smuggled in.** Work that no area van could take shows in the at-risk/unplanned list with the reason, so you can add a van or move it to another day.
- **A safety check on shape.** Any finished route whose two furthest stops are more than a set distance apart is flagged on the route card, so a bad shape is visible immediately even if it was legal.

## Technical notes

- `supabase/functions/route-optimize/index.ts`:
  - New clustering step per day, after the pool is built: difficult-area legs group by `areaIdx`; remaining legs cluster by distance (seed from the leg furthest from the depot, absorb legs within `CLUSTER_RADIUS_MI`, repeat), then merge any cluster smaller than a few jobs into its nearest neighbour when the merged radius stays inside the cap.
  - Each cluster gets a skill id; jobs carry their cluster skill, plus the corridor rule: a leg gets an additional cluster's skill when its perpendicular distance to the depot→cluster-centroid line is under `CORRIDOR_MI` and it is not beyond the cluster centroid.
  - Vehicles are built per cluster with that cluster's skill; long-day (15h) stays reserved for one difficult-area cluster, normal clusters keep 13h.
  - Van allocation: sort clusters by must-go count then job count, give each one van, distribute the rest by remaining jobs/spaces; a single VROOM `/solve` per day still covers all vans and jobs, with skills doing the containment.
  - The fill pass and van-reduction loop keep the existing no-job-lost rule, operating on the allocated vans.
  - Keep `{per_hour: 1100, per_km: 28}` costing, priorities (100 must-go / 50 ordinary), the 90-second budget, and real vans only.
  - Route `spread_miles` (already computed) drives the flag using `SPREAD_WARN_MI`.
- Tunables as constants: `CLUSTER_RADIUS_MI` (default 30), `CORRIDOR_MI` (default 12), `MIN_CLUSTER_JOBS` (default 3).
- Route cards surface the area name per route; no schema change needed beyond existing `route_plans.debug`.
