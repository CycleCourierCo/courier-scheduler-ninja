# Open several saved routes in new tabs at once

## What you'll see
- Each route in the Load Saved Route popup gets a tick box, plus a "Select all" tick for the routes currently shown by the search.
- A new button, **Open selected in new tabs (N)**, appears at the bottom when at least one route is ticked.
- Clicking it opens each ticked route in its own browser tab on Job Scheduling, with that route loaded exactly as if you'd pressed **Load** (stops, breaks, start time, starting bikes and the saved route name, so **Save** updates the same route).
- The current tab stays as it is. The single **Load** button keeps working as now.
- If the browser blocks pop-ups after the first tab, a message tells you to allow pop-ups for this site.

## Technical details
- `LoadRouteDialog.tsx`: `selectedIds` state with checkboxes; on open-selected, call `window.open('/scheduling?savedRoute=<id>', '_blank')` for each id synchronously in the click handler (keeps pop-up allowance); count `null` returns to show the blocked warning.
- `JobScheduling.tsx`: read `savedRoute` param; once orders have loaded, fetch that `saved_routes` row and run the same rehydration as `handleLoadRoute` (move it into a shared helper so both paths match), then pass it to the Route Builder's existing load-route handler and open the timeslots popup. Show an error toast if the route can't be found or isn't visible.
- No database or permission changes; existing route-sharing rules apply.
