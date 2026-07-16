# Bike Value — Customer Filter & Leaderboard

Extend the existing Bike Value Analytics tab so users can slice the metrics by customer and see a ranked leaderboard by total value moved and average value per bike.

## Changes

### 1. `src/services/bikeValueAnalyticsService.ts`
- Extend `FlatBike` with `customerName` (derived from `order.sender.name` — matches how B2BLeaderboard/PerformanceLeaderboard identify customers).
- Add optional `customerName?: string` filter to `BikeValueRange` (or a new `BikeValueFilter` param) applied inside `flattenBikes`/`inRange` consumers so `getBikeValueMetrics` and `getDailyBikeValueSeries` respect it.
- Add `getCustomerBikeValueLeaderboard(orders, range?)` returning:
  ```ts
  Array<{
    customerName: string;
    totalValue: number;
    totalBikes: number;
    valuedBikes: number;
    avgValuePerBike: number;
    highestBikeValue: number;
  }>
  ```
  sorted by `totalValue` desc.

### 2. `src/components/analytics/BikeValueLeaderboard.tsx` (new)
- Mirrors `B2BLeaderboard`/`PerformanceLeaderboard` styling: Card + search input + sortable table inside `ScrollArea`.
- Columns: Rank, Customer, Bikes, Total Value (GBP), Avg / Bike (GBP), Top Bike (GBP).
- Sort toggles on Total, Avg, Bikes (default Total desc).
- Clicking a row calls `onSelectCustomer(name)` to drive the filter above.

### 3. `src/pages/AnalyticsPage.tsx` (Bike Value tab section)
- New state `bikeValueCustomer: string | null`.
- Customer picker in the tab header row (next to the 7d/30d/… range buttons): a `Select`/`Combobox` populated from `getCustomerBikeValueLeaderboard(orders).map(r => r.customerName)`, with an "All customers" option and a "Clear" affordance. Selecting a row in the leaderboard sets this state.
- Pass the customer filter through the memoized `bikeValueScoped` / `bikeValueDaily` calls so **stat cards, daily chart, and breakdown charts** all update.
- The all-time cards keep their current all-time scope but also respect the customer filter (so "All Time" means all-time-for-that-customer when one is selected). Label updates to include the customer name when set.
- Render `<BikeValueLeaderboard />` below the existing charts, always unfiltered by customer (so users can pick a new one), and always unfiltered by date range OR toggled to the current range — default: current range, so the leaderboard reflects the selected period.

## Notes
- Customer identity uses `order.sender.name` trimmed, consistent with the other analytics leaderboards.
- Cancelled orders continue to be excluded (already handled in `flattenBikes`).
- No schema/DB changes; purely client-side derivation from already-loaded orders.
