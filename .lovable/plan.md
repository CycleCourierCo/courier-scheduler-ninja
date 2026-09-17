# Date filter for the Business Customers leaderboard

The Business Customers leaderboard on the Analytics page (Customers tab) always shows all-time totals. Add a period picker so you can see the rankings for a chosen window instead.

## What you'll see

- A small period dropdown in the leaderboard header, next to the search box:
  - This week
  - This month
  - Last month
  - Last 3 months
  - Last 12 months
  - All time (the current behaviour, and the default)
- The table re-ranks customers using only orders created in the chosen period, and shows the period label in the card subtitle (e.g. "Last 3 months").
- Clicking a customer still opens their order list — now showing only the orders inside the chosen period so the numbers match the table.

## Technical notes

- `src/services/analyticsService.ts`: `getAllCustomersAnalytics(orders)` gains an optional `range?: { start: Date; end: Date }` parameter, filtering on `order.createdAt` before counting (same approach as the existing bike-value leaderboard).
- `src/pages/AnalyticsPage.tsx`: add a `b2bRangeDays` state ("7" | "this-month" | "last-month" | "90" | "365" | "all"), compute the range, memoise `b2bCustomers` and a period-filtered `orders` slice, pass both to `B2BLeaderboard` (so `CustomerOrdersDialog` reflects the same window).
- `src/components/analytics/B2BLeaderboard.tsx`: accept a `rangeLabel` and render a compact `<select>` (matches the existing bike-value leaderboard style, mobile-safe) plus the label in the header. No other behaviour changes.
- "This week" = Monday to now; "This month" / "Last month" = calendar months, consistent with the rest of the analytics page.
