## Problem

The Flip Route button was added to `MultiJobTimeslotDialog`, but the "Route Timeslots" popup shown in the user's screenshots is a different component — the timeslots drawer/dialog inside `src/components/scheduling/RouteBuilder.tsx`. That's why it doesn't appear.

## Change

In `src/components/scheduling/RouteBuilder.tsx`:

1. Add a `handleFlipRoute` handler that:
   - Reverses the current `selectedJobs` array (preserving any Lunch/Stop break entries in their reversed positions).
   - Calls `setSelectedJobs` with the reversed list.
   - Immediately calls the existing `refreshAndCalculateTimeslots()` to recompute arrival times against the flipped sequence.
   - Toasts success / failure.

2. Render a "Flip Route" button (using the `ArrowUpDown` icon, matching the style already used in `MultiJobTimeslotDialog`) next to the existing "Recalculate" button in **both** places:
   - The mobile Drawer version (near line 3451).
   - The desktop Dialog version (near line 3629).
   - Disabled when `selectedJobs.length < 2` or while recalculating.

No changes to business logic, backend, or the send flow — only the sequence order and the follow-up recalculation that already exists.
