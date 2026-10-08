# Faster Get Timeslots + loading popup with progress

## Why it's slow
Get Timeslots asks the map service for drive times one stop at a time, waiting for each answer before asking the next. A 20-stop route means 21+ waits in a row, and sometimes the whole thing runs twice (when a customer's work address is used).

## Changes
1. **Ask for all drive times at once.** Before timing the route, request every stop-to-stop leg (plus depot out and back) in parallel, then work out the times from those answers instantly. Same results, much quicker.
2. **Remember drive times.** Keep legs already looked up during the session, so adding, removing or re-ordering a job only fetches the new legs. The second pass (work-address swap) reuses them too.
3. **Open the popup straight away** when you press Get Timeslots, showing a spinner, "Working out drive times… 7 of 21" and a progress bar. The job list fills in when done. Later updates inside the popup keep the existing "Updating times…" note.
4. If a lookup fails, behave as today (error message and rough fallback times).

## Technical details
- RouteBuilder.tsx `calculateTimeslots`: build unique leg pairs from grouped stops, `Promise.all` with a concurrency cap (~6) over `calculateTravelTime`, incrementing a `progress {done,total}` state; `computeChain` reads from a `legCacheRef` Map keyed by rounded coords (5 dp).
- `setShowTimeslotDialog(true)` at start of the run; dialog renders loader + Progress when `isCalculating && progress.total>0` and no times yet. Keep the `calcRunRef` latest-run guard.
