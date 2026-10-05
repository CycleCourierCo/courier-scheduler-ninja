# Add all route jobs to Shipday from the Get Timeslots popup

## What changes

1. Add an **Add all to Shipday** button to the Route Timeslots popup header, next to Recalculate / Re-optimise / Flip Route / Bulk Message — in both the desktop popup and the mobile drawer version.
2. The button counts the jobs in the current route (the timed stops in the popup) that are not on Shipday yet, and shows that count in the label, e.g. "Add all to Shipday (6)".
3. Pressing it adds each missing collection or delivery to Shipday one by one, with a spinner while it works and the button disabled so it can't be pressed twice.
4. Jobs already on Shipday are skipped. Jobs still being checked are skipped too, so nothing gets added twice.
5. For larger batches (more than 20 jobs) the same "are you sure?" prompt used by the existing Add all missing button appears first.
6. When finished, the jobs are re-checked so their red crosses turn to green ticks, and a message reports how many were added and how many failed.

## Technical details

- `src/components/scheduling/RouteBuilder.tsx` only — no other files.
- New handler `handleAddRouteJobsToShipday`: filters `selectedJobs` (excluding breaks) to those where `getShipdayStatus(orderData, type)` is not `verified` or `pending`, then loops `createShipdayOrder(job.orderId, job.type)` exactly like the existing `handleAddAllMissingToShipday` (success/fail counts, toasts, `notify.confirm` above 20 jobs, `onReVerifyShipday()` at the end).
- Button placed in the dialog header button row (~line 4290) and the matching Drawer header (~line 4016), disabled while `isLoadingShipday`, `isVerifyingShipday`, or when there are no route jobs to add.
- Reuses the existing `isLoadingShipday` state so the popup button and the main-page "Add all missing" button can't run at the same time.
