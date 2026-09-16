# Fix: route length not always updating after a manual time change

On the Get Timeslots popup, typing a new time for a stop re-times the later stops, but the route summary (end ETA and total length) sometimes stays on the old value.

## Why it happens

The summary refresh only runs when at least one stop from the edited stop onwards has map coordinates. So it is skipped when:

- the edited stop is a break, or the last stop, and no later stop has coordinates
- any of the later stops are missing coordinates (address not geocoded)

In those cases the stop times visibly change but the ETA and "Route Length" figures are left untouched, so they disagree with the list.

## The fix

- Always refresh the summary after a manual time change, never conditionally.
- Work out the return-to-depot leg from the last stop in the route that has coordinates (searching from the end of the list), instead of only from the edited stop onwards.
- When no stop in the route has coordinates, fall back to the final stop's time plus a standard allowance, so the ETA and length still move.
- Guard against an end time that lands before the route start time (overnight rollover) so the length never shows a nonsense value.
- Total distance stays as it is: a time edit does not change the stop order, so mileage is unchanged.

## Technical notes

- File: `src/components/scheduling/RouteBuilder.tsx`, `updateStopTime`.
- Replace the `if (lastLocationCoords)` gate around the `setRouteStats` block: pick the return-leg origin by scanning `list` backwards for the first stop with `lat`/`lon`, and compute `currentTime` from the final stop's `estimatedTime` when the edited-stop loop never set coordinates.
- Keep `durationMinutes` derived from `startTime`; if the computed end is earlier than start, treat it as next-day (add 24h) before differencing rather than clamping to 0.
- No changes to `calculateTimeslots`, drag/reorder, sending timeslots, database, or edge functions.
