# Fix "Add all to Shipday (0)" on loaded routes

## Cause
The Shipday check only runs for jobs shown in the job list on the scheduling page. Jobs on a loaded route that aren't in that list (other dates, filtered out, etc.) are never checked, so they stay "checking" forever. The button deliberately skips "checking" jobs, so it shows 0 and is greyed out. Also, each new check wipes the previous results instead of adding to them.

## Fix
1. When a route is loaded or jobs are added to it, check Shipday for every route job too (not only the visible job list).
2. Keep earlier check results instead of replacing them, so the route's results aren't wiped when the list changes.
3. The button counts jobs with no Shipday ID, jobs confirmed missing, and jobs whose check never finished. If a check is still running, the button says "Checking Shipday..." instead of showing 0.
4. Before adding jobs, the app re-checks the route's jobs with Shipday, so it never adds a job twice.

## Technical details
- `RouteBuilder.tsx`: add a `useEffect` keyed on a signature of `selectedJobs`' shipday pickup/delivery IDs that calls `onVerifyVisibleShipday` with those IDs together with the visible IDs (one combined call, so the run-ID guard doesn't cancel either).
- `JobScheduling.tsx` `verifyShipdayIds`: merge into existing state (`prev => ({...prev, ...data.results})`) for verification and pickup addresses; stop clearing state on empty input.
- `handleAddRouteJobsToShipday`: before pushing, call the verify function on the route's IDs and skip any confirmed `true`.
