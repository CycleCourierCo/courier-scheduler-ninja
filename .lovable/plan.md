# Back to open planning, with London fenced off

The last change turned **every** drawn area into its own dedicated zone. Since your drawn areas are the far-out ones (Scotland, Wales, the South West, Kent), vans got tied to those and the day came out as nothing but long-distance runs. That goes away.

## What changes

1. **Remove the area-fencing for all drawn areas.** Planning goes back to how it was before: one open pool of jobs, any van can take any job, and a drawn area only does what it did originally — it can earn the one longer 15-hour day.
2. **One exception: London.** Jobs that fall inside the drawn London area are only given to the van(s) dedicated to London that day. Other vans cannot pick them up.
3. **London vans.** One van is dedicated to London when there is London work; a second is added only if the London jobs won't fit in one van's space or day. If there is no London work that day, no van is reserved and nothing is held back.
4. **On-the-way jobs stay allowed.** The London van can still take non-London jobs that sit within 12 miles of the line out to London, so it isn't driving empty each way.
5. **Route cards** show "London" on the dedicated van; all other routes go back to no area label, as before.

## Technical detail

In `supabase/functions/route-optimize/index.ts`:

- Delete the cluster layer added last time: `buildClusters`, `skillsFor`, the `Cluster`/`Assignment` types, cluster-per-drawn-area splitting, workload-based cluster allocation, and cluster-scoped van reduction / spare-van checks. Keep `CORRIDOR_MI`; drop `CLUSTER_RADIUS_MI` and `MIN_CLUSTER_JOBS`.
- Identify the London area by matching a drawn area whose name contains "london" (case-insensitive) — `londonAreaIdx`. All other `areaIdx` values keep their existing long-day-only meaning.
- Skills: jobs with `areaIdx === londonAreaIdx` get `skills: [1]`; non-London jobs within `CORRIDOR_MI` of the London centroid also get `[1]` (so they may ride along) — no, they get **no** skills, so any van including the London van can take them. Every other job carries no skills. Only the London-dedicated vehicle(s) carry `skills: [1]`; all other vehicles carry no skills.
- Van allocation returns to the previous flat model: full fleet available, fill pass when work is left over, van reduction only when no jobs are lost — with the London vehicle(s) reserved out first.
- Long-day selection keeps its existing rule (drawn area with enough jobs, capped by `max_long_days`), unchanged.
- `deno check`, then deploy `route-optimize`.
