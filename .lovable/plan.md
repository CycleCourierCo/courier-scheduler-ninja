## Goal
Add a "Load into Shipday" button to the Job Scheduling filter section that pushes every currently filtered job into Shipday so the route planner can build routes from them.

## Changes

### `src/components/scheduling/RouteBuilder.tsx`
- Add `isLoadingShipday` state and a `handleLoadFilteredIntoShipday` async handler.
- Handler iterates `availableJobs` (already date/status/job-type filtered) and for each job calls `createShipdayOrder(job.orderId, job.type)` — sending pickup or delivery individually so we don't push a delivery for a job the planner only wants collected, and skipping jobs that already exist in Shipday (via `getShipdayStatus(job.order, job.type) === 'exists'`).
- Track successes / skipped / failures, show progress toast (`toast.info` at start, `toast.success`/`toast.warning` at end with counts).
- On completion call `onReVerifyShipday?.()` so the ticks update.
- Confirm via `window.confirm` before running when more than ~20 jobs to avoid accidental mass push.
- Render the button in the Filter Section block (around line 3035, before the CSV buttons) with the `Send` icon, label "Load filtered into Shipday", `disabled={isLoadingShipday || availableJobs.length === 0}`, and a spinner while loading.

## Out of scope
- No edge function changes — reuses existing `create-shipday-order` via `createShipdayOrder`.
- No changes to filter logic, clustering, or Shipday verification edge function.
- No changes to JobScheduling.tsx top filter row.
