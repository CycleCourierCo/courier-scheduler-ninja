# Restore Shipday status on Job Scheduling cards

## What is happening

The job cards still contain the Shipday indicator, but an unchecked job renders as a small grey dash. The page currently verifies only orders scheduled for the selected day, while the available-jobs list can show many other orders. Those visible cards therefore remain unchecked and never receive the green tick or red cross shown after verification.

## Changes

1. Verify the Shipday status for the jobs currently shown in the available-jobs list, without returning to the previous full-backlog request that caused the page to hang.
2. Keep the existing meanings and actions:
   - Green tick: the job exists correctly in Shipday.
   - Red cross: the job is missing from Shipday and can be clicked to add it.
   - Amber warning: a ferry job has the wrong Shipday address and can be rebuilt.
   - Loading spinner: verification or syncing is in progress.
3. Replace the near-invisible fallback dash with a clear pending indicator only while a visible job has not yet been checked.
4. Make the icons large enough to read on mobile and use the theme’s semantic status colours so they remain visible in both light and dark mode.
5. Preserve the current job-card layout, filters, Shipday matching rules, and click behaviour.

## Technical notes

- Update the verification flow shared by `src/pages/JobScheduling.tsx` and `src/components/scheduling/RouteBuilder.tsx` so the parent receives the currently visible Shipday IDs and verifies only that bounded set.
- Update `renderShipdayIcon` to use semantic status tokens and an accessible, stable icon container.
- Validate on the mobile scheduling view shown in the screenshot and on desktop, confirming verified and missing states are visibly distinct and card selection still works.
- No database, Shipday order-creation, scheduling, or theme-wide changes.
