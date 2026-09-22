# Fix: "Edge Function error" when generating routes

## What's actually happening

The generator's own log ends with `CPU Time exceeded` right after the extra-van
"what-if" solve finished (`verso solve … virtual: true, ms: 1148`). So the plan
itself was worked out fine — the run was killed by the platform before it could
save and reply, which the screen reports as an edge function error.

Why it runs out: one Generate press does up to six full optimiser calls on the
same big data set (297 jobs / 50 vans), and every reply carries full drawn route
lines that have to be read back in each time:

1. main solve
2. up to 3 repair re-solves (the log shows all three being used)
3. a second solve to add deliveries for bikes collected earlier
4. an extra-van "what-if" solve used only for the "short by 1 van" message

Then the plan is saved one route at a time, and each of its stops separately.

## The fix

Cut the work down and never let the run die silently:

- Keep a time budget for the run. Once it is used up, the optional steps
  (repair re-solves, what-if) are skipped and the plan that already exists is
  saved and returned, with a small note that the extra-van figures were skipped.
- Ask for drawn route lines only on the final solve that is actually shown;
  intermediate solves are asked for without them.
- Reduce the repair loop from 3 re-solves to 1.
- Move the extra-van "what-if" out of the main press: the plan is returned
  first, and the "short by 1 van" figures load separately in the background,
  so a slow or heavy what-if can never break Generate.
- Save the plan in bulk (all routes in one write, all stops in one write)
  instead of a write per route and per route's stops.
- If the run is still killed, the screen shows a clear message ("that many days
  and vans was too much to plan in one go — try fewer days") instead of a raw
  edge function error.

## Technical notes

- `supabase/functions/route-optimize/index.ts`: add a `deadline` (≈ 90s budget)
  checked before the repair loop, pass B and the what-if; drop `options.g` on
  non-final solves; repair attempts `3 → 1`; batch the `route_plan_routes` and
  `route_plan_stops` inserts (insert routes with `.select('id')`, then map stops
  in one insert); remove the `resp.clone().text()` double-reads in `postSolve`.
- New `supabase/functions/route-shortfall/index.ts` holding the virtual-van
  solve, taking `plan_id` and returning the per-day shortfall; `verify_jwt = true`
  in `supabase/config.toml`.
- `src/services/routeGenerationService.ts`: add `fetchPlanShortfall(planId)`;
  `RoutePlanResult` gains `shortfall_pending?: boolean`.
- `src/components/scheduling/generate/GenerateRoutesDialog.tsx`: after a plan
  returns, fetch the shortfall and merge it into the day cards; show the
  friendlier failure message.
