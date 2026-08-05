# Inspections booked vs completed, plus a mechanic comparison chart

## 1. Inspections booked vs completed chart

The existing "Inspections Over Time" chart plots one line only — inspections by the month they were created (booked). Add a second series for completed inspections, counted by the month the inspection was actually carried out.

- Booked = inspection record created in that month.
- Completed = inspection has an inspected-at date in that month.
- Both lines share the same month axis, so months where bikes were booked but not yet inspected show a visible gap.
- Chart title becomes "Inspections Booked vs Completed", with a legend for the two lines and a summary line under it (total booked, total completed, still outstanding).

## 2. Mechanic comparison chart

Add a bar chart on the Inspections tab comparing mechanics side by side, using the same data the Mechanic Profitability table already produces (inspection revenue, repair revenue, labour revenue, wage cost, profit, labour profit, hours).

- Grouped bars per mechanic: Total revenue, Labour revenue, Wage cost, Profit.
- A small toggle to switch the chart between "Revenue & profit" and "Efficiency" (revenue per hour and profit per hour), so it isn't just a duplicate of the table.
- Same date range controls as the existing profitability panel (defaults to the current month), with the mechanic table's totals shown above the chart.
- Placed on the Analytics page Inspections tab; the existing table on the profitability page stays as-is.

## Technical notes

- `src/services/inspectionAnalyticsService.ts`: change `getInspectionsOverTime` to return `{ month, label, booked, completed }`, bucketing `created_at` for booked and `inspected_at` for completed, and union the month keys so both series cover the full range.
- `src/components/analytics/InspectionsOverTimeChart.tsx`: render two `<Line>` series (`booked`, `completed`) with distinct semantic token colours; rename the card title.
- New `src/components/analytics/MechanicComparisonChart.tsx`: `useQuery` on `getMechanicProfitability(fromISO, toISO)` (reuse the service in `src/services/mechanicProfitabilityService.ts`), date inputs like `MechanicProfitabilityPanel`, recharts `BarChart` with the metric-mode toggle. Derive per-hour metrics client-side from `totalRevenue`/`profit`/`hoursWorked`.
- `src/pages/AnalyticsPage.tsx`: render the new chart inside the Inspections tab grid below the existing charts.
