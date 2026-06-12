## Goal
Add an **"Inspected only"** toggle filter on the Job Scheduling page so schedulers can surface bikes whose inspection is already complete.

## Why
When planning deliveries, the team needs to quickly isolate bikes that have already been inspected (or repaired) and are ready for the next scheduling step, separate from bikes still awaiting inspection work.

## Changes

### 1. JobScheduling.tsx — lift new filter state
- Add `showInspectedOnly` boolean state.
- Add `onShowInspectedOnlyChange` handler.
- Pass the new state and handler down to `RouteBuilder`.
- Update `filteredOrdersForMap` so that when the filter is on, only orders with a completed inspection (`inspection_status === 'inspected' || inspection_status === 'repaired'`) are kept.

### 2. RouteBuilder.tsx — wire filter through component
- Add `showInspectedOnly` and `onShowInspectedOnlyChange` to `RouteBuilderProps`.
- Add internal/external state handling (same pattern as `showCollectedOnly`, `showExpiredDatesOnly`, etc.).
- Update `getJobsFromOrders` so that when `showInspectedOnly` is true, only jobs belonging to orders whose `inspection_status` is `'inspected'` or `'repaired'` are returned.
- Add a Switch toggle in the filter bar, positioned after the existing toggles, labelled **"Inspected only"**.

## No database changes required
`needs_inspection` and `inspection_status` are already fetched on every scheduling-orders query and available on `OrderData`.

## Existing visual indicator preserved
The `getInspectionStatusBadge` helper already renders "Inspection Done" or "Inspection Pending" badges on each job card, so users can still see the exact state of any bike that appears while the filter is off.