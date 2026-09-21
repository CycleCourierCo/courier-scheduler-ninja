# Fix "Use this route" opening a 404

## What's wrong
"Use this route" opens `/job-scheduling?jobs=...&date=...` in a new tab, but the scheduling page lives at `/scheduling`. So the new tab shows the "Wrong turn" 404 page instead of Get Timeslots with the route preloaded.

## The fix
In `src/components/scheduling/generate/GenerateRoutesDialog.tsx` (`handleUseRoute`), change the opened URL from `/job-scheduling?...` to `/scheduling?...`, keeping the same `jobs` and `date` parameters.

The scheduling page already reads those parameters and preloads the job sequence, so no other change is needed.

## Result
Clicking "Use this route" locks the route and opens the scheduling page in a new tab with that route's stops already selected in order.
