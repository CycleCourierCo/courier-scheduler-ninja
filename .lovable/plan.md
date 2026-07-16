## Goal
Always show the "Get Timeslots" button at both the top and bottom of the Route Builder, even when no jobs are selected. It should be disabled (with a helpful tooltip/label) until at least one job is selected.

## Changes
File: `src/components/scheduling/RouteBuilder.tsx`

1. **Top button (currently line ~3125-3132):** Remove the `selectedJobs.length > 0 &&` wrapper so the button always renders. Set `disabled={selectedJobs.length === 0}` and label it dynamically:
   - `Get Timeslots (0 jobs)` when empty (disabled)
   - `Get Timeslots (N jobs)` when populated (enabled)

2. **Bottom button (currently line ~3387-3394):** Same treatment — remove the conditional wrapper, always render, disable when `selectedJobs.length === 0`, same dynamic label.

No other behaviour changes: clicking still calls `calculateTimeslots()` exactly as before.

## Out of scope
- No styling overhaul, no sticky positioning, no mobile-specific placement changes.
- No changes to the timeslot dialog, filters, or any other button.