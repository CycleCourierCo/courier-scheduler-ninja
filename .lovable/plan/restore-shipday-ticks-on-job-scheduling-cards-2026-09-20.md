# Restore Shipday ticks on Job Scheduling cards

## What is happening

The jobs shown in the screenshot are on Shipday, but their cards display a small grey dash. The page currently verifies only orders scheduled for the selected day, while the available-jobs list can show many other orders. Those visible cards therefore remain unchecked instead of displaying their green Shipday tick.

## Changes

1. Verify the Shipday status for the jobs currently shown in the available-jobs list, in controlled batches so all 509 visible jobs can resolve without returning to the previous single full-backlog request that caused the page to hang.
2. Keep the existing meanings and actions:
   - Green tick: the job exists correctly in Shipday.
   - Red cross: Shipday verification explicitly confirms the job is missing, and it can be clicked to add it.
   - Amber warning: a ferry job has the wrong Shipday address and can be rebuilt.
   - Loading spinner: verification or syncing is in progress.
3. Replace the misleading fallback dash with a clear loading/pending indicator only while a visible job is waiting to be checked; a stored Shipday ID must not be shown as missing merely because verification is still pending.
4. Make the icons large enough to read on mobile and use the theme’s semantic status colours so they remain visible in both light and dark mode.
5. Preserve the current job-card layout, filters, Shipday matching rules, and click behaviour.

## Technical notes

- Update the verification flow shared by `src/pages/JobScheduling.tsx` and `src/components/scheduling/RouteBuilder.tsx` so the visible Shipday IDs are verified in bounded batches and their results are merged without discarding earlier batches.
- Update `renderShipdayIcon` to use semantic status tokens and an accessible, stable icon container.
- Validate on the mobile scheduling view shown in the screenshot and on desktop, confirming verified and missing states are visibly distinct and card selection still works.
- No database, Shipday order-creation, scheduling, or theme-wide changes.
