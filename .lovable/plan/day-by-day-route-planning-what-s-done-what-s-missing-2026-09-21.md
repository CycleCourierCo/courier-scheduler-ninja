# Day-by-day route planning: what's done, what's missing

## Already working

- Both ways of planning are built when you press Generate: "Balanced across the days" and "Day by day".
- Each appears as its own tab with stops, van-days, hours, miles and jobs at risk, so you can compare them.
- The day-by-day planner fills each day as full as it will go before looking at the next day, and only offers a delivery once its collection has happened (plus the inspection wait where that applies).
- Either plan can be locked per day and handed to Get Timeslots; locking always acts on the plan you are looking at, and a new run only replaces the previous run of the same kind.
- Saved plans record which kind of planning produced them.

## Gaps still to close

1. **Jobs left over is not shown.** Neither tab tells you how many jobs could not be fitted. Day-by-day planning deliberately leaves later jobs behind, so this is the single most important number for comparing the two. Add a left-over count per day and per plan, shown on the tab and in the day summary.
2. **No reason when day-by-day fails.** If that planner errors, the tab just says "not available" with no explanation. Show the reason and offer a retry for that tab alone.
3. **Costings only cover the day you're viewing.** The money figures (mileage, driver pay, profit) are per day. Add a whole-plan cost line per tab so the two ways of planning can be compared on cost, not just stops and hours.
4. **No warning after you lock a day.** Once a day is locked and jobs are reserved, the other tab's figures are out of date but still look live. Mark the other tab as out of date after any lock or hand-off.
5. **Duplicated cost rates.** The mileage and hourly rates are written out again inside the Route Builder instead of using the shared rates, so a future price change could be applied in one place and missed in the other.
6. **Two alternatives from the earlier brief were never built:** "More jobs" and "Shortest day" variants of a day.

## Technical notes

- Left-over count: `route-optimize` already knows every leg it considered and everything it placed; expose `unplanned_count` per day and per plan, and surface it through `summarisePlan` in `routeGenerationService.ts`.
- Failure reason: stop swallowing the greedy call with `.catch(() => null)` in `GenerateRoutesDialog.tsx`; keep a per-mode error string plus a per-tab retry.
- Whole-plan costs: reuse `src/lib/routeCosts.ts` and total across `plan.days[].variants[0].routes`; keep the admin-only gating that `DaySummary` already applies.
- Staleness: track which mode last locked or handed off and badge the other tab.
- Refactor `RouteBuilder.tsx` to import the shared rate constants from `src/lib/routeCosts.ts`.
- Items 1-5 are contained changes; item 6 (extra day variants) is a larger piece of optimiser work and is best done on its own afterwards.
