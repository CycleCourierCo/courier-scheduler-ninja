# Remove the Reconcile Shipday button

The "Reconcile Shipday (24h)" button on the Job Scheduling page doesn't work and isn't needed, so it goes away entirely.

## Changes

- Job Scheduling page: delete the button and its click handler, plus the now-unused `isReconciling` state.
- Keep the existing Shipday verification behaviour (the automatic check on load and the "re-verify" action in the route builder) untouched.
- Leave the `reconcile-shipday-orders` edge function in place but unreferenced from the UI, so nothing else that may call it breaks.

## Technical detail

- `src/pages/JobScheduling.tsx`: remove lines for the button block (~265-290) and the `isReconciling` useState (line 58). `verifyShipdayOrders` stays since it is still used on load and by the route builder.
