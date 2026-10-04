# Predicted end-of-period lines on Analytics charts

Add a dashed "Predicted" line to three Analytics charts, projecting the current incomplete period to its end: count so far ÷ days elapsed in the period × total days in the period.

## 1. Inspections Booked vs Completed

- `src/services/inspectionAnalyticsService.ts`: `getInspectionsOverTime` returns an extra `predicted` field per month. Current month = booked so far ÷ days elapsed × days in month (rounded, Europe/London date). Past months = actual booked count. Future months = no value.
- `src/components/analytics/InspectionsOverTimeChart.tsx`: dashed third line "Predicted (booked)" in a muted colour.

## 2. Orders Created

- `src/services/analyticsService.ts`: `getOrdersCreatedSeries` returns an extra `predicted` field per bucket. Works for all three granularities — current day, current week (count ÷ days elapsed × 7), or current month (count ÷ days elapsed × days in month). Past buckets = actual count; future buckets = no value.
- `src/components/analytics/OrdersCreatedChart.tsx`: dashed "Predicted" line.

## 3. Orders Completed

- `src/services/analyticsService.ts`: `getOrdersCompletedSeries` returns `predictedOrders`, `predictedCollections`, `predictedDeliveries` per bucket, same projection rule.
- `src/components/analytics/OrdersCompletedChart.tsx`: three dashed predicted lines matching the colours of the existing Orders / Collections / Deliveries lines.

No other charts or pages change.
