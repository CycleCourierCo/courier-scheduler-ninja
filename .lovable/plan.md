# Stop the Get Timeslots route snapping back

## What's going wrong
When you add, remove or re-optimise, the stop list changes straight away and the map updates. Working out the times then runs in the background, checking the travel time for each stop one at a time, which takes a few seconds. If a slower, older calculation finishes after a newer one, it saves its old stop list over the new one. The map then jumps back to the previous route.

Two things make this more likely:
- Several actions in a row (for example, adding two jobs quickly, or Re-optimise followed by Remove) start calculations that overlap.
- If the travel-time check fails, the backup times are built from the stop list as it was when that calculation started, so this can also bring old stops back.

## Fix
- Only the most recent calculation is allowed to save its result. Results from older calculations are thrown away.
- The backup path uses the stops that calculation was given, not an old copy.
- A small "Updating times…" note shows while times are being worked out, so it's clear the result is on its way.

## Technical details
- In `RouteBuilder.tsx` `calculateTimeslots`, add a `calcRunRef = useRef(0)`; increment at start, capture `runId`, and before every `setSelectedJobs` / `setRouteStats` / `setShowTimeslotDialog` (success and catch) bail if `runId !== calcRunRef.current`.
- Catch-block fallback maps over `jobs` (the argument) instead of the `selectedJobs` closure.
- Expose an `isCalculating` state (set by the latest run only) and show it beside the map toolbar in both popups.
- No change to the map component; its own fetch is already guarded against stale results.
