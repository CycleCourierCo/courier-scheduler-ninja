## Goal
Add an "Avg Bike Value" stat to the Inspections tab on the Analytics page, showing the average declared bike value across all inspected bikes.

## Changes

### 1. `src/services/inspectionAnalyticsService.ts`
- Extend the analytics select to also pull `orders.bikes` (JSONB) and `orders.bike_value` fallback.
- Add `getAverageBikeValue(inspections)` returning `{ average, sampleSize }`. For each inspection, read declared values from `orders.bikes[].value` (parsed as number, ignoring blanks/zero); fall back to `orders.bike_value` if `bikes` is empty. Average across every individual bike (not per-order) so multi-bike orders contribute multiple values.

### 2. `src/pages/AnalyticsPage.tsx`
- Compute `avgBikeValue` from the new helper.
- Add a fourth `StatsCard` in the Inspections tab grid (change grid to `sm:grid-cols-4`) titled "Avg Bike Value", value `£{avgBikeValue.average.toFixed(2)}`, description `Across {sampleSize} bikes`, using the `PoundSterling` (or `Bike`) icon.

## Out of scope
No changes to data entry, no schema changes, no edits to existing repair-cost metric.
