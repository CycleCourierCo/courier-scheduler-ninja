# Customer Orders Dialog — Time Filters

Add date-range and granularity controls to the customer drill-down chart on the B2B Leaderboard so users can slice an individual customer's order history by day / week / month and by custom or preset date ranges.

## Scope

Frontend only. No service/data-layer rewrite, no backend changes. Reuses the existing `TimeSeriesFilters` component that already powers the other analytics charts, so the UX stays consistent.

## Changes

### 1. `src/services/analyticsService.ts`
- Add a new helper `getCustomerOrdersOverTimeRanged(orders, customerName, range, granularity)` that:
  - Filters the customer's orders by `range.start`/`range.end` (using `created_at`).
  - Buckets counts by `day`, `week` (ISO Monday), or `month`, matching the bucketing already used by `OrdersCreatedChart`.
  - Returns `{ bucket: string; label: string; count: number }[]` with zero-filled buckets across the selected range so the line chart stays continuous.
- Keep the existing `getCustomerOrdersOverTime` for backward compatibility (or switch its single call site over).

### 2. `src/components/analytics/CustomerOrdersDialog.tsx`
- Add local state: `range: TimeRange` and `granularity: Granularity`.
- Default range = last 6 months, default granularity = `month` (preserves current behavior).
- Reset state whenever `customerName` changes (so reopening for another customer starts clean).
- Render `<TimeSeriesFilters />` in the dialog header area, right under the title/description.
- Derive `data` from the new ranged helper.
- Update the `XAxis dataKey` to use the new generic `label` field (already produced by the helper) so it works for day/week/month.
- Update the dialog total ("N orders over time") to reflect the filtered range.
- Slightly widen the dialog (`max-w-4xl`) so filters + chart fit comfortably on desktop; keep it responsive on mobile.

### 3. No changes to
- `B2BLeaderboard.tsx` (still just opens the dialog).
- `TimeSeriesFilters.tsx` (reused as-is).
- Any data fetching — all filtering happens client-side over the already-loaded `orders` prop.

## UX notes

- Preset buttons (4w / 8w / 12w / 6m / 1y / All) + custom date range popover + Day/Week/Month toggle, identical to other analytics charts.
- "All" preset uses the customer's earliest order date as the floor.
- Empty state ("No order history available.") still shows when the filtered range has zero orders.
