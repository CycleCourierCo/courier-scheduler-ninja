## Goal

On the Analytics → Overview tab, replace the single "Orders by Week" chart with two filterable time-series cards:

1. **Orders Created** – orders placed in the system (what the current chart shows, fixed).
2. **Orders Completed** – three lines on one chart: Orders fully completed (both collected + delivered), Collections completed, Deliveries completed.

Both cards get their own controls:
- **Date range** picker (from / to, defaults to last 12 weeks). Quick presets: 4w, 8w, 12w, 6m, 1y, All.
- **Granularity** toggle: Daily / Weekly / Monthly.

## Fix for the "missing week" glitch

`getOrderTimeAnalytics` only returns buckets that have at least one order, so weeks with zero orders disappear and the line connects straight across the gap. The new aggregator will:
- Compute the full list of buckets between range start and range end at the chosen granularity.
- Initialise every bucket to `0`, then add counts.
- Always emit every bucket so empty periods render as `0` instead of being skipped.

There is also a date-mutation bug in the current code (`orderDate.setDate(diff)` mutates `orderDate` mid-calculation); the new helper will use immutable date math.

## What completion means

Reuses the existing tracking-event helpers in `analyticsService.ts`:
- `getCollectionTimestamp(order)` → bucket counts as a "collection completed" in the period containing that timestamp.
- `getDeliveryTimestamp(order)` → "delivery completed".
- "Orders completed" = orders where both timestamps exist; bucketed by the **delivery** timestamp.

So an order created in March but delivered in May contributes to March's "Created" bar and May's "Completed/Delivery" bars — matching how the team thinks about throughput.

## UI / files

New / changed files:

- `src/services/analyticsService.ts`
  - Add `Granularity = "day" | "week" | "month"` and `TimeRange = { start: Date; end: Date }`.
  - Add `getOrdersCreatedSeries(orders, range, granularity)` – returns `{ bucket: string; label: string; count: number }[]` with **all** buckets filled.
  - Add `getOrdersCompletedSeries(orders, range, granularity)` – returns `{ bucket: string; label: string; orders: number; collections: number; deliveries: number }[]`.
  - Keep the old `getOrderTimeAnalytics` export for any other callers (no breaking change).

- `src/components/analytics/OrdersCreatedChart.tsx` (new)
  - Card with title, date-range popover (uses shadcn `Calendar` with `mode="range"`, `pointer-events-auto`), preset buttons, granularity `ToggleGroup` (Daily/Weekly/Monthly), and a Recharts `LineChart` of `count`.

- `src/components/analytics/OrdersCompletedChart.tsx` (new)
  - Same controls; Recharts `LineChart` with three lines: Orders, Collections, Deliveries, plus a legend.

- `src/components/analytics/TimeSeriesFilters.tsx` (new, small shared sub-component)
  - Renders the preset buttons, range picker, and granularity toggle so both cards stay in sync visually without duplicating markup.

- `src/pages/AnalyticsPage.tsx`
  - In the `overview` tab, replace `<OrderTimeChart data={orderTimeData} />` with `<OrdersCreatedChart orders={orders} />` and add `<OrdersCompletedChart orders={orders} />` below it (stacked full-width under the existing status pie). Drop the now-unused `orderTimeData` computation.

- `src/components/analytics/OrderTimeChart.tsx` – leave file in place (not imported anywhere else after this change, but kept so nothing breaks if referenced elsewhere; can be deleted in a follow-up if confirmed unused).

## Technical notes (for reviewers)

- Bucket key formats: day = `yyyy-MM-dd`, week = ISO Monday `yyyy-MM-dd`, month = `yyyy-MM`. Labels formatted via `date-fns` (`MMM d`, `MMM d – MMM d`, `MMM yy`).
- Bucket iteration uses `date-fns` `eachDayOfInterval` / `eachWeekOfInterval` / `eachMonthOfInterval` (already a dep via `react-day-picker`).
- All filtering/aggregation runs client-side over the already-fetched `orders` array — no new Supabase queries, no schema changes.
- Default range: last 12 weeks, granularity = Weekly (matches today's behaviour, so the page looks familiar on first load).

## Out of scope

- No changes to other tabs (Customers, Business, Products, Performance, Inspections, Vehicles).
- No backend, RLS, or migration changes.
- No changes to how collection/delivery timestamps are derived from tracking events.
