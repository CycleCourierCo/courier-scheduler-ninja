# Fix the overflowing analytics charts

## What's happening

Performance Trend, Storage Bays Over Time and Storage Analytics all render wider than the phone screen and push the page sideways, while their neighbours get squashed.

These are the only analytics cards that nest a second chart sizing wrapper inside the shared chart wrapper: `ChartContainer` (`src/components/ui/chart.tsx`) already renders a recharts `ResponsiveContainer`, and each of these cards puts another `ResponsiveContainer width="100%" height="100%"` inside it. The inner container measures against a parent that has no measured width yet, so it never shrinks back down on narrow screens and keeps the widest size it ever computed. `ChartContainer` itself is a flex box with no `min-width: 0`, so that oversized child stretches the card instead of being clipped.

The same nesting exists in the Collection Time and Delivery Time charts, so they are affected identically and get fixed in the same pass.

## The fix

- Remove the redundant inner `ResponsiveContainer` from the five affected charts, passing the chart (LineChart / BarChart / ComposedChart) directly as the `ChartContainer` child — which is how `ChartContainer` is designed to be used and how the other analytics charts already do it.
- Harden the shared `ChartContainer` so a chart can never widen its card again: add full width, `min-width: 0` and horizontal clipping to its wrapper.
- Keep every chart's appearance unchanged: same fixed heights, axes, legends, tooltips, colours and series.

Files: `src/components/ui/chart.tsx`, and in `src/components/analytics/`: `PerformanceTrendChart.tsx`, `StorageLevelsChart.tsx`, `StorageAnalyticsChart.tsx`, `CollectionTimeChart.tsx`, `DeliveryTimeChart.tsx`.

## Verification

Load the Analytics page at 360px wide, open the Performance and Storage sections, and confirm the page's scroll width equals the viewport width and each chart fits inside its card.
