# Predicted inspections line on the Booked vs Completed chart

Add a third, dashed "Predicted (booked)" line to the Inspections Booked vs Completed chart on the Analytics page.

## How it's calculated

For each month:

- **Past months**: prediction equals the actual booked count (the month is complete, so nothing to predict).
- **Current month**: booked so far ÷ days elapsed in the month × total days in the month (rounded). E.g. 20 booked by day 10 of a 31-day month → predicted 62.
- **Future months**: no prediction.

## Changes

- `src/services/inspectionAnalyticsService.ts`: `getInspectionsOverTime` returns an extra `predicted` field per month, computed as above using the current date (Europe/London).
- `src/components/analytics/InspectionsOverTimeChart.tsx`: add a dashed third `<Line>` for `predicted` in a muted colour, labelled "Predicted (booked)" in the legend.

No other charts or pages change.
