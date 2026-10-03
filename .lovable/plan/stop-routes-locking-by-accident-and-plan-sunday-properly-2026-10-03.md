# Stop routes locking by accident, and plan Sunday properly

## What's happening (checked against live data)

**How Sunday got locked.** At 08:30 London time you pressed **Use route** on five routes (KU17DDH, DF66UZB, KV18WHR, AV66UTH, WP10NVL) to open them in Get Timeslots. Pressing Use route also quietly **locks** that route. Its 71 jobs are reserved and kept out of every later run. Nothing on screen says this, and there's no way to undo it from the planner. You didn't do anything wrong.

**Why the new routes look bad.** Every run since has only been planning the **63 leftover jobs**: Pembrokeshire, far-flung singles and so on. Spread over 9 vans, that gives long, thin routes of around 7 jobs that lose money. The same five vans were also given a second Sunday route.

**Expired and last-date jobs for Sunday.** There are 25 of them:
- 17 are on the five locked routes, including EASBS9 and CHRM11
- 8 are on the latest run
- 1 was missed: PASPE8, a delivery whose last date is Sunday

## Changes
1. **Use route won't lock any more.** It just opens the route in Get Timeslots. Locking only happens when you press **Lock day** yourself.
2. **Unlock Sunday now.** As part of this change I'll release today's five accidental locks, so the next Generate plans the whole of Sunday again.
3. **Locked-day notice with an Unlock button.** If a day has locked routes, the planner will show something like "Sun 4: 5 routes locked (71 jobs) — KU17DDH, …" with an **Unlock** button. That way you can always see a lock and undo it.
4. **No second routes for locked vans.** A van that already has a locked route that day is shown unticked with a "locked" label. It's only used again if you tick it yourself.
5. **Fewer weak routes.** At the moment a van is kept if dropping it would leave even one job undone, which is how you got a 2-job van. Instead, a van will only be kept if it carries a must-go job (expired, last date or guaranteed) or makes a profit. Ordinary jobs on a dropped van go back to a later day.
6. **Missed must-go jobs are listed.** Any expired or last-date job left off, like PASPE8, shows in the at-risk list with the reason.

## Technical details
- `selectPlanRoute`: set `selected: true` only. Don't set `day_status: 'locked'`. Change the toast to "Opened in Get Timeslots".
- Data fix: update the five Sunday 4 Oct `route_plan_routes` rows from plan c398bfe7… back to `day_status 'draft'`, `selected false`.
- New `fetchLockedDays(dates)`: locked or confirmed routes per date, with plan id, van and stop count. Unlock calls `unlockPlanDay` per plan and date.
- `GenerateRoutesDialog`: shows the notice above the van grid and leaves locked vans out of the default ticks.
- route-optimize:
  - Exclude vans with a locked route that day unless they're in `van_availability[date]`.
  - Pruning: keep a van only if removing it loses must-go work, or its margin is ≥ 0.
- Deploy route-optimize. No test plan run, because it would replace your active plan.
