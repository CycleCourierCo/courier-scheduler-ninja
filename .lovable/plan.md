# Re-optimise without the route limits

## What changes

The Re-optimise button in the Route Timeslots popup currently refuses to reorder a route when the stops exceed the van's bike spaces or the 13-hour working day — the same limits the full "generate route" optimisation uses. The user wants Re-optimise to simply find the best order for the stops already chosen, whatever the totals.

## Plan

1. In the `route-optimize` edge function's reorder branch:
   - Remove the van-capacity constraint (no bike-spaces amounts on the VROOM jobs/shipments, no vehicle capacity).
   - Remove the 13-hour day limit (no vehicle time window) so every stop can always be placed.
   - Keep: depot start and finish, the chosen shift start time (for the driving-time/miles estimate), 15 minutes per stop, and collection-before-delivery for the same order.
   - Keep the same-location clustering (City Air Express / Tom Lambe fix) and the postcode-vs-pin check.
2. Frontend (RouteBuilder.tsx):
   - Drop the "these stops don't fit within the van or day limits" rejection path — with no limits, stops can only be unplaced if a collection/delivery pairing is impossible, which the function will still report.
   - Success message unchanged (driving time + miles, Undo).

## Out of scope

- The full "generate route" optimisation keeps its limits — only Re-optimise changes.
- No change to saved routes or timeslot editing.

## Technical details

- File: `supabase/functions/route-optimize/index.ts`, `mode: 'reorder'` branch (~lines 295–330): build VROOM jobs/shipments without `amount`/`pickup`/`delivery` amounts; vehicle without `capacity` and `time_window`; keep `shipments` for pickup-before-delivery precedence. Redeploy the function.
- File: `src/components/scheduling/RouteBuilder.tsx`, `handleReoptimise` (~line 2511): remove the `unassigned` toast rejection (keep `bad_locations` handling).
- Verify: Deno check on the function, tsgo on the frontend, then ask the user to re-run Re-optimise on a route that previously failed the limits.
