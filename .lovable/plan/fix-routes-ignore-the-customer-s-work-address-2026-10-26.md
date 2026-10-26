# Fix: routes ignore the customer's work address

## What's wrong
For CCC754159147108VROBA2 (Sean Tobin), the customer gave a work address (79 Whiteladies Road, Bristol, 9:00–17:00 today). The route builder picked it correctly — the saved stop text says "79 Whiteladies Road" at 12:35 — but the stop's map pin was saved at his **home in Bath**. So the Live Map, the route line, ETAs and drive times all point to Bath.

Cause: three places in the route builder re-read the home address from the order and overwrite the stop's location, without checking whether the stop was set to Work:
1. When timings are calculated (the "refresh coordinates" step before calculating).
2. The "Recalculate" fresh-coordinates step.
3. When the route is saved / updated.

Northern Ireland ferry stops use the same step, so they must keep working.

## Fix
- One shared rule: a stop's location = ferry hand-off for NI legs, otherwise the **work address when the stop is set to Work** (auto by time, or the planner's manual Home/Work toggle), otherwise home.
- Use that rule in all three places so the address text and the map pin always match.
- Save which one was used (home/work) on each saved stop, so reloading a route keeps it.
- Repair existing saved routes: where a stop's saved address text is the customer's work address but the pin is the home one, move the pin to the work address (today's route for this order included). Timeslip snapshots already frozen are left alone except today's.

## Check
- Add a test: a delivery at 12:35 with a 09:00–17:00 work window on that date resolves to the work coordinates; at 18:00 it resolves to home; an NI leg still resolves to the ferry.
- Re-query this order's stop to confirm the pin is now in Bristol (BS8).

## Technical details
- `src/components/scheduling/RouteBuilder.tsx`: `refreshAndCalculateTimeslots` (~2777), `calculateTimeslots` leg refresh (~3087), `updateSavedRouteRow` (~2205) and the save-new path (~2921) all call `resolveStopCoords`/`getLegContact` unconditionally. Route them through a helper in `src/lib/altLocation.ts` (e.g. `resolveStopLocation(order, type, date, time, override)`), reapplying `applyAddressChoice` after refresh.
- Persist `addressSource` in `job_data`; `rehydrateSavedJobs` restores it as the override.
- One-off data fix via SQL update on `saved_routes.job_data` (and today's `timeslips.planned_snapshot`) matching on work-address text.
