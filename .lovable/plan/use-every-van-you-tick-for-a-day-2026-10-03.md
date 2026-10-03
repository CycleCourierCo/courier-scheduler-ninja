# Use every van you tick for a day

## What's happening (checked against live data)

**Vans.** On 1 Oct at 18:43, five vans were marked as off for Sunday 4 Oct: KW65ULZ, WX67ZRC, PN12VOV, WP10NVL and LK67PRZ. The optimiser respects those saved days off. But the planner screen ignores them when it opens and shows every van as ticked. So the screen showed 9 vans ticked while the optimiser only got 4 (the last run's notes confirm "vans offered: 4"). Ticking a van that already looks ticked does nothing, so you had no way to put them back.

**Jobs for Sunday 4 Oct.** I counted about 150, not 230:
- 90 collections with Sunday as a customer date
- 128 deliveries with Sunday as a date. Only 61 of those are collected and either inspected or not needing an inspection, so only those 61 can go out.
- plus the 21 expired jobs

Collections planned for Sunday can't be delivered that same day, which is why the other deliveries drop out. That's still more than enough work for more than 4 vans, so the van problem is the real cause.

## Changes
1. **The ticks show the truth.** When the planner opens, it reads the saved days off. A van that's off is shown unticked for that day.
2. **Your ticks win.** The optimiser uses exactly the vans ticked on screen for each day. Ticking or unticking still saves the day off as it does now, so the next time you open the planner it shows the same.
3. **Visible if a save fails.** If saving a tick fails, you'll see an error message instead of it failing silently.
4. **Clear count on the results.** Each day's results will show "X of Y vans used", where Y is the vans the optimiser was actually given.

## Technical details
- `GenerateRoutesDialog`: on open, fetch `van_unavailability` for the default dates (and when a date is added) and build `grid` with blocked vans excluded. Replace the `.catch(() => null)` calls on `setVanUnavailable` with a toast on error.
- route-optimize: when `van_availability[date]` is supplied, use that list as-is (still limited to `in_use`/`off_road` vans). Only apply the `van_unavailability` filter for days without a grid entry.
- Deploy route-optimize. I won't run a test plan because it would replace your active plan. To check: open the planner, see the five vans unticked for Sun 4, tick them, then Generate.
