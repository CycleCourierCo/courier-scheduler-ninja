# Plan around routes you've already locked

## What's happening (checked against live data)

**Sunday 4 Oct already has 5 locked routes.** You picked them from the 08:30 run (London time): KU17DDH 15 stops, DF66UZB 14, KV18WHR 17, AV66UTH 12, WP10NVL 13. That's 71 stops, which are good, full routes.

Locked jobs are reserved, so every run since then has only planned the **63 leftover jobs**. Those are the scattered ones nobody took: Pembrokeshire, far-flung singles and so on. Spread across 9 vans, they make long, thin routes of around 7 jobs that lose money.

Two things make it worse:
1. **Vans that already have a locked route are offered again.** In the latest run, KU17DDH, DF66UZB, KV18WHR, AV66UTH and WP10NVL each got a second Sunday route on top of their locked one.
2. **Nothing on screen says the day is already part-planned.** So the new routes look like the whole day's plan.

**Expired and last-chance jobs for Sunday.** There are 25 of them:
- 17 are already on the locked routes, including EASBS9 and CHRM11
- 8 are on the latest run's routes
- 1 was missed: PASPE8, a delivery whose last date is Sunday, collected and not waiting on an inspection

So they are being covered, just split across the locked routes and the new run.

## Changes
1. **Locked-day notice in the planner.** Each day that already has locked routes will show something like "Sun 4: 5 routes locked (71 jobs) — KU17DDH, DF66UZB, …". Next to it is a **Release and re-plan** button. That button unlocks those routes so the next Generate plans the whole day from scratch.
2. **Locked vans aren't used twice.** A van with a locked route that day is shown unticked with a "locked" label. The optimiser won't give it a second route unless you tick it on purpose.
3. **Whole-day summary.** The day's results will show the locked routes and the new ones together: total vans, total jobs and how many expired or last-date jobs are covered. That way you see Sunday as a whole, not just the leftovers.
4. **Fewer weak leftover routes.** At the moment a van is kept if dropping it would leave even one job undone. That's why there's a 2-job van. Instead, a van will only be kept if it carries a must-go job (expired, last date or guaranteed) or makes a profit. Ordinary jobs on a dropped van go back to a later day.
5. **Missed last-chance jobs are listed.** Any expired or last-date job left off, like PASPE8, will appear in the at-risk list with the reason it didn't fit.

## Technical details
- New service `fetchLockedDays(dates)`: reads `route_plan_routes` with `day_status in ('locked','confirmed')` for the selected dates and returns the plan id, route id, van id, van name and stop count. Release calls `unlockPlanDay(planId, date)` for each plan that has locked routes on that date.
- `GenerateRoutesDialog`: shows the locked-day notice above the van grid, and leaves vans with a locked route that day out of the default ticks.
- route-optimize:
  - Load the locked routes' van ids per date and exclude them unless the van is explicitly in `van_availability[date]`. A van that is in the list but locked counts as an explicit choice.
  - Add `locked_routes` per day to the response so the summary can combine them.
  - Pruning rule changes from "kept: work would be left undone" to "kept only if must-go work would be lost, or margin ≥ 0".
- Deploy route-optimize. I won't run a test plan because it would replace your active plan. To check: open the planner, see the Sunday notice, choose either "plan around locked" or "Release and re-plan", then Generate.
