## Bike Value Analytics

Add a new **Bike Value** tab on the Analytics page that tracks the monetary value of bikes moved.

### Data source
Read from the orders already fetched by `fetchOrdersForAnalytics` (order snapshots — the source of truth). For each order, extract per-bike values from the `bikes` JSONB array (`bike.value`), falling back to the legacy `bike_value` field × `bike_quantity`. Use `createdAt` (or `scheduled_pickup_date` — see question) to bucket by day. Only count non-cancelled orders.

### New service: `src/services/bikeValueAnalyticsService.ts`
- `getBikeValueMetrics(orders, range)` returning:
  - `totalValueMoved` — sum of all bike values in the range
  - `totalBikes` — count of bikes in the range
  - `avgValuePerBike` — total ÷ bikes (overall for the range)
  - `avgValuePerDay` — total ÷ active days in the range
  - `avgBikesPerDay`
  - `highestValueDay` `{ date, value }`
  - `highestValueBike` `{ value, orderId, brand, model }`
  - `valueByBikeType` — top bike types by total value
  - `valueByBrand` — top brands by total value
- `getDailyBikeValueSeries(orders, range)` returning `[{ date, totalValue, bikeCount, avgValuePerBike }]` for charting.
- `getAllTimeBikeValueStats(orders)` — same shape as metrics but across every order, for the "since start" figure.

### New components
- `src/components/analytics/BikeValueStatsCards.tsx` — grid of `StatsCard`s (Total Value Moved, Avg Value/Day, Avg Value/Bike, Bikes Moved, Highest-Value Day, Highest-Value Bike, All-Time Total, All-Time Avg/Bike).
- `src/components/analytics/DailyBikeValueChart.tsx` — recharts combo chart: bars for daily total value, line for avg value per bike.
- `src/components/analytics/BikeValueBreakdownChart.tsx` — two side-by-side bar charts: top bike types and top brands by total value.

### Page changes: `src/pages/AnalyticsPage.tsx`
- Add a new `TabsTrigger value="bike-value"` (with `PoundSterling` icon) and matching `TabsContent`.
- Add a small local time-range selector (7d / 30d / 90d / All) plus custom date range, mirroring the vehicles-tab pattern.
- Render the stats cards, daily chart, and breakdown charts inside the tab.
- Keep existing `Avg Bike Value` on the Inspections tab untouched.

### Technical notes
- Currency formatted as `£` with `Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' })`.
- Ignore bikes with missing/non-numeric value when computing averages, but still count them in `totalBikes` for the volume figure only when explicitly relevant (documented in code).
- All computation is `useMemo`'d against `orders` and the selected range — no new network calls.

### Open question
One clarification before I build:
- Should "per day" use **order creation date** (`created_at`) or **scheduled collection date**? I'll default to `created_at` unless you say otherwise.
