## Correction
Previously I updated the wrong dialog (`MultiJobTimeslotDialog`). The popup in the screenshot ("Route Timeslots" with Start/End Lawden Rd rows and "Send All (SendZen)") is actually rendered by `src/components/scheduling/RouteBuilder.tsx`. That's where the end depot time + summary need to live.

## Changes — `src/components/scheduling/RouteBuilder.tsx`

### 1. Capture per-leg distance in `calculateTravelTime`
Change the helper to return `{ minutes: number; meters: number }` instead of just minutes:
- Pull `data.results[0].distance` alongside `time`.
- Update the 3 call sites (`calculateTimeslots` at ~1618, `sendAllTimeslots`-map at ~2814, and the return-leg call at ~2820) to read `.minutes`.

### 2. Track route totals + end time in `calculateTimeslots`
Inside the loop:
- Accumulate `totalMeters` from every travel leg.
- Accumulate service time (15 min per non-break stop) and break durations into `totalMinutes`.
- Sum travel minutes into `totalMinutes`.

After the loop:
- Compute one final `calculateTravelTime(lastLocationCoords, baseCoords)` for the return-to-depot leg.
- Add its minutes/meters to the totals.
- Derive `endTime` = start time + total minutes (formatted `HH:mm`, rounded to next 5-min).
- Save into new state `routeStats: { endTime, distanceMiles, durationMinutes } | null`.

Reset `routeStats` to `null` when the jobs list is emptied / on error.

### 3. Render end ETA + summary (mobile + desktop blocks)
Both the mobile block (lines 3397-3403) and desktop block (lines 3527-3533) currently show only bike count on the "End: Lawden Rd" row.

- Add a `<Badge variant="outline">{routeStats?.endTime}</Badge>` next to the End row (only when `routeStats` exists), mirroring the Start row's time badge.
- Immediately below the End row, add a new muted `Card` "Route Summary" with 4 stats:
  - **Stops** — `selectedJobs.filter(j => j.type !== 'break').length`
  - **Orders** — `new Set(selectedJobs.filter(j => j.type !== 'break').map(j => j.orderId)).size`
  - **Total Distance** — `routeStats.distanceMiles.toFixed(1)` mi
  - **Route Length** — `Xh Ym` from `routeStats.durationMinutes`

Rendered only when `routeStats` is set. Same component reused in both mobile and desktop branches.

## Revert
Undo the earlier additions in `src/components/scheduling/MultiJobTimeslotDialog.tsx` and `src/services/routeOptimizationService.ts` (the depot card, summary card, and `endArrivalTime` / `totalDurationMinutes` return fields) since that popup is not the one the user sees. Restore both files to their prior shape.
