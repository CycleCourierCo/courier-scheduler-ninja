# Limit long "expedition" days in route planning

Right now, whenever any job on a day sits in a difficult area, the planner offers a 15-hour long-day version of **every** van for that day. Those long vans are cheap per hour and can also take ordinary jobs, so the optimiser fills them first and nearly every route comes back badged "Expedition 15h".

**Would one long day a day clear the work?** Of the 547 outstanding collection/delivery stops, only 40 sit inside a difficult area: 25 Cornwall & Devon, 6 Margate/East Kent, 4 Carlisle & Lakes, 4 Pembrokeshire, 1 Northumberland. Those are five corners of the country that cannot share a van, and on most of the next two weeks three to five of those areas are open on the same date. So one long day per day would leave far-flung work stranded — two is the realistic default, with the option to set it to 1, 3 or 4 by eye.

## What changes

1. **Cap how many long days exist per day.** Instead of a long-day twin for every van, the planner offers only as many long-day vans as the difficult-area work actually needs (difficult stops divided by van capacity), with a hard ceiling — default 2 per day.
2. **Make a long day genuinely expensive.** A long-day van carries a premium shift cost plus a higher hourly rate for the hours beyond a normal shift, so the optimiser only uses one when it rescues work a normal shift cannot reach.
3. **Only badge a route as an expedition when it really is one.** A route on a long-day van that finishes inside normal shift hours is shown as a normal route, not "Expedition 15h".
4. **Give you control.** Generate Routes gets a "Max long days per day" setting (0–4, default 2). Set it to 0 and no long days are offered at all; difficult-area jobs that then don't fit appear in the leftover/at-risk list rather than silently disappearing.
5. Same rules apply to the grace/expiring-job placement pass and to the greedy daily planner, so they cannot re-introduce unlimited long days.

## Technical detail

- `supabase/functions/route-optimize/index.ts`
  - `buildVehicles`: replace `if (opts.difficultDates.has(date)) push(2, EXPEDITION_CAP_H)` with a per-date budget — count difficult legs whose windows include that date, derive `needed = ceil(count / avg capacity)`, clamp to `min(maxLongDays, dayVans.length)`, and attach the long-day (`skills: [1]`) twin only to that many vans.
  - Long-day costing: `costs.fixed = round(EXPEDITION_CAP_H * DRIVER_PENCE_PER_HOUR * EXPEDITION_PREMIUM)` (premium ~1.5) and `per_hour` raised for kind 2, so ordinary work is cheaper on a normal van.
  - Accept `max_long_days` in the request body (validate 0–4, default 2); when 0, skip kind-2 vehicles entirely.
  - Apply the same capped budget in the grace-pass vehicle build (`difficultGrace`) and in the greedy branch.
  - When persisting routes, set `is_expedition` only if `meta.expedition && duration > capH * HOURS`.
- `src/services/routeGenerationService.ts`: pass `max_long_days` through the generate call.
- `src/components/scheduling/generate/GenerateRoutesDialog.tsx`: add the "Max long days per day" control next to the existing run controls; keep the badge rendering as-is (it now fires only for true long routes).
- No schema change; no change to job eligibility, dates or pricing.
