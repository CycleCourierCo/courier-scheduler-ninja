# Fix the "Add all to Shipday" confirmation

## Cause
The confirmation appears as a pop-up message at the top of the screen, but the Timeslots window blocks clicks on anything outside it, so "Add all" and "Cancel" can't be pressed.

## Fix
Replace that message with a proper confirmation box that opens on top of the Timeslots window (desktop and mobile), with "Cancel" and "Add all" buttons. Pressing "Add all" starts adding the jobs as before; batches of 20 or fewer still go straight through.

## Technical details
- `RouteBuilder.tsx` only: add `pendingShipdayPush` state; `handleAddRouteJobsToShipday` sets it instead of calling `notify.confirm` when >20 jobs.
- Render a shadcn `AlertDialog` (portal stacks above the Radix Dialog/Drawer, so pointer events work) whose action runs the stored push and clears the state.
