# Pack the routes and use every available van

## What's going wrong

Two things in the planner actively work against full routes:

1. **It takes vans off the road too eagerly.** After the first plan is made, a tidy-up loop looks at every route with fewer than 13 stops and tries the day again without that van — up to 6 times. It only refuses when a date-critical job would be lost. Ordinary jobs are allowed to fall off the plan entirely. That is why 5 vans become 3 and work is left over.

2. **Ordinary jobs carry no weight.** Date-critical jobs are marked as top importance; everything else is marked as zero importance. To the optimiser, leaving an ordinary job undone is free, while driving to it costs money — so it leaves stops out and routes come back thin and oddly shaped.

On top of that, when a day has work in more than one difficult area, all the work in the other areas is removed from that whole day, and only a single quick optimisation attempt is made, so the stop order is whatever the first pass produced.

## What I'll change

- **Give every job real weight.** Ordinary work gets solid importance, date-critical work stays highest. The optimiser will then try hard to fit everything rather than dropping stops.
- **Flip the van logic.** A van is only taken off the day if the plan without it still carries *every* job the plan with it carried. No job is lost to save a van. If jobs are left over, the planner instead brings any unused van back in and re-plans so the leftover work gets driven.
- **Fill before trimming.** After the first plan, if anything is unassigned, re-plan with all available vans for that day before considering any trimming at all.
- **Ask for a better plan.** Use the optimiser's deeper search setting instead of a single quick pass, within the existing 90-second budget, so stop order and grouping improve.
- **Stop discarding other difficult areas.** Work outside the chosen long-day area stays in the day's pool for the normal 13-hour vans where its own opening hours allow it, instead of being dropped from the day.
- **Report honestly.** Each day shows vans used out of vans available, stops per route, and anything still unplanned with the reason.

## Technical notes

- `supabase/functions/route-optimize/index.ts`:
  - `buildJob`: priority `100` for must-go, `50` for ordinary (was `0`).
  - Section 3.5: replace "remove weakest route under `targetJobs`" with "remove only if the retry serves the same job set (no losses, must-go or ordinary)".
  - New fill pass between 3.4 and 3.5: if any pool leg is unassigned and vans are idle, re-solve with the full `vansForDate[date]` list.
  - Section 3.6 spare-van check stays as a hint only, no virtual vans.
  - Lines 753-754: keep non-chosen difficult-area legs in `pool` (no long-day skill), rather than excluding them.
  - `postSolve` payload options: add exploration level alongside `g`, with a guarded fallback to `{ g: true }` if Verso rejects the field, so a rejected option never fails the run.
  - Keep 13h/15h caps, `{per_hour: 1100, per_km: 28}` costing, and the 90s time budget unchanged.
- No schema or frontend behaviour changes; `GenerateRoutesDialog` keeps its current controls.
