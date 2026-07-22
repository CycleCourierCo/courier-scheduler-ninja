Add a **Flip Route** button to the Get Timeslots (multi-job) dialog that reverses the current stop order and re-optimizes the arrival times against Geoapify so the returned times reflect the reversed direction.

### File
`src/components/scheduling/MultiJobTimeslotDialog.tsx`

### Behaviour
- Button sits next to the date picker / optimization status at the top of the dialog.
- Disabled while `isOptimizing`, when no date is selected, or when `optimizedJobs.length < 2`.
- On click:
  1. Take the current `optimizedJobs` sorted by `sequenceOrder` ascending and reverse the list.
  2. Call the existing route optimizer against the reversed list with `preserveOrder: true` (see below) so Geoapify computes fresh `estimatedArrivalTime` values for the reversed path starting at 09:00, without re-solving the TSP.
  3. `setOptimizedJobs(result.jobs)` with new `sequenceOrder` = 1..N in the reversed order, and refresh `jobTimes` from the returned arrival times.
  4. Toast: "Route flipped and re-timed".

### Route service change — `src/services/routeOptimizationService.ts`
- Add an optional `preserveOrder?: boolean` flag to `optimizeRouteWithGeoapify`.
- When `true`, skip the TSP/reordering step and instead compute leg-by-leg travel times for the caller-supplied job order (Geoapify Routing API for the chained waypoints, or sequential Routing calls per leg), then stamp `estimatedArrivalTime` on each stop starting from the given start time plus a standard dwell allowance already used in the service.
- Preserve current default behaviour (`preserveOrder` unset ⇒ optimize as today).

### Non-goals
- No DB schema changes.
- No changes to RouteBuilder card, WhatsApp/email dispatch, or the single-job dialog.
- Not re-running the full optimizer — the user explicitly wants the reversed order kept and only the timings recomputed.