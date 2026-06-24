
## Are the current Performance numbers accurate?

Mostly correct arithmetic, but two real issues:

1. **Wrong source of truth.** Today the service derives collection/delivery times by scanning `trackingEvents.shipday.updates` and fuzzy-matching `description` strings for "collect"/"deliver". That's noisy and silently drops events with missing descriptions. We already have authoritative timestamps on the orders table — `collection_confirmation_sent_at` and `delivery_confirmation_sent_at` — set by our backend the moment the courier confirms the leg. These should be the primary signal.
2. **No date filter + no outlier handling.** Averages are computed across every order ever created, so "creation → collection" mixes courier performance with how far in advance customers book. The number looks worse than it is.

DB coverage (just checked):
- `collection_confirmation_sent_at`: 3,523 / `delivery_confirmation_sent_at`: 3,815
- `order_collected` flag: 4,655 / `order_delivered`: 4,532 / `status='delivered'`: 4,568

So the confirmation columns are best when present; we fall back to Shipday events for older orders that pre-date the confirmation-sent fields.

## What we'll change

### 1. New, prioritised timestamp resolution
In `src/services/analyticsService.ts`, replace `getCollectionTimestamp` / `getDeliveryTimestamp` with a resolver that tries, in order:
1. `collection_confirmation_sent_at` / `delivery_confirmation_sent_at` (authoritative)
2. Latest Shipday update whose `orderId` matches `trackingEvents.shipday.pickup_id` / `delivery_id` (uses the real fields on the type, not the non-existent `shipdayPickupId`)
3. Today's description-match fallback (only when neither of the above exists)

`fetchOrdersForAnalytics` already does `select("*")`, so both new columns are loaded automatically — just need to surface them on the mapped `Order` (extend `Order` type with optional `collectionConfirmationSentAt` / `deliveryConfirmationSentAt` and populate them in `mapDbOrderToOrderType`).

### 2. Add the requested third metric: creation → delivery
`DeliveryTimeAnalytics` already exposes `averageTotalDuration`, but it's not surfaced as a KPI. Add two new `StatsCard`s on the Performance tab:
- "Avg Order → Delivery"
- "Order → Delivery SLA" (within 72h, constant)

### 3. Date range + granularity filters on the Performance tab
- Reuse the existing `TimeSeriesFilters` component at the top of the Performance tab. Defaults: last 8 weeks, week granularity.
- `getCollectionTimeAnalytics`, `getDeliveryTimeAnalytics`, `getStorageAnalytics` accept an optional `TimeRange` and filter by `createdAt` falling inside it (matches the user's mental model of "orders booked in this period").

### 4. Trend chart — how the metrics change over time
New `PerformanceTrendChart` (recharts `LineChart`) with three series bucketed by the selected granularity:
- Avg hours **creation → collection**
- Avg hours **collection → delivery**
- Avg hours **creation → delivery**

Plus a small "vs previous period" delta badge per metric (▲ +2.1h destructive / ▼ −0.8h success) so direction-of-travel is obvious.

New service function `getPerformanceTrendSeries(orders, range, granularity)` buckets each delivered order by its `createdAt` period and averages the three durations.

### 5. Slowest-customers leaderboard
New `PerformanceLeaderboard` card (mirrors `B2BLeaderboard`'s pattern), replacing the two existing top-5 bar charts:
- Columns: Customer · Orders · Avg → Collection · Avg → Delivery · Avg Total · SLA hit rate
- Sortable headers, top 20
- Rows with SLA hit rate < 75% highlighted destructive so customers needing attention stand out
- Click a row → opens existing `CustomerOrdersDialog` (already supports date filtering)

### 6. Min-sample guard
Customers with fewer than 3 completed orders in the selected window are excluded from leaderboard averages (single bad orders currently dominate today's chart).

## Technical summary

Files touched:
- `src/types/order.ts` — add optional `collectionConfirmationSentAt?: Date`, `deliveryConfirmationSentAt?: Date`.
- `src/services/orderServiceUtils.ts` — map the two new columns into the Order.
- `src/services/analyticsService.ts` — new prioritised timestamp resolver, accept `TimeRange` in the three timing functions, add `getPerformanceTrendSeries` and `getPerformanceLeaderboard` with min-sample filter.
- `src/components/analytics/PerformanceTrendChart.tsx` — **new**, 3-series line chart + delta badges.
- `src/components/analytics/PerformanceLeaderboard.tsx` — **new**, sortable table with drill-in.
- `src/pages/AnalyticsPage.tsx` — add `perfRange` / `perfGranularity` state, render `TimeSeriesFilters` atop Performance tab, pass range into analytics functions, add new stat cards, render trend chart + leaderboard, remove the two old `CollectionTimeChart` / `DeliveryTimeChart` mounts (components left in place for now).
- No backend / migration. All client-side over the already-loaded `orders` query.

UX: identical filter strip to other tabs (preset pills 4w/8w/12w/6m/1y/All + custom range + Day/Week/Month). Mobile: stat cards stay 2-col, trend chart full-width, leaderboard becomes horizontally scrollable.
