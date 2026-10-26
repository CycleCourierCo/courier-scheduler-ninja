# Optional follow-ups to the home/work address fix

The fix itself is already done and confirmed (stop 6 now in Bristol). These small extras are still open:

1. Add an automatic check: a stop set to Work keeps its work location when the route is saved, reloaded or recalculated; a Home stop and a Northern Ireland ferry stop are unchanged.
2. Re-time today's routes that had a stop moved, so arrival times and drive times use the work location.

## Technical details
- Extract `savedStopCoords` from `RouteBuilder.tsx` into `src/lib/altLocation.ts` and add `altLocation.test.ts` covering work / home / ferry cases.
- Re-timing is done by reloading the affected route in Route Builder and pressing Recalculate (no data change needed from me).
