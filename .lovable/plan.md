# B2B Leaderboard + Customer Detail Popup

## Scope
Analytics page (`src/pages/AnalyticsPage.tsx`), Business tab — extend the existing `TopCustomersChart` usage with a full leaderboard and a click-through detail dialog.

## Changes

### 1. New component: `src/components/analytics/B2BLeaderboard.tsx`
- Full ranked table of **all** B2B customers (not just top N), sorted by order count desc.
- Columns: Rank, Customer Name, Order Count.
- Scrollable card with sticky header.
- Each row is clickable → opens detail dialog for that customer.
- Optional search/filter input at the top for quick lookup.

### 2. New component: `src/components/analytics/CustomerOrdersDialog.tsx`
- shadcn `Dialog` triggered by leaderboard row click.
- Header: customer name + total order count.
- Body: line/bar chart (Recharts) of that customer's orders over time, grouped by month (reuse the date-bucketing pattern from `getOrderTimeAnalytics`).
- Derives data client-side from the already-fetched `orders` array filtered by customer name/id — no new query needed.

### 3. `src/services/analyticsService.ts`
- Add `getCustomerOrdersOverTime(orders, customerName)` returning `{ month: string; count: number }[]` sorted chronologically.
- Existing `getTopCustomersAnalytics` is unchanged (kept for the existing chart on the Customers tab).

### 4. `src/pages/AnalyticsPage.tsx` (Business tab only)
- Replace `<TopCustomersChart data={b2bCustomers} />` with `<B2BLeaderboard customers={b2bCustomers} orders={orders} />`.
- Leaderboard owns the dialog state and renders `CustomerOrdersDialog` internally.
- Other tabs (Customers, Overview, etc.) untouched — top-10 bar chart stays where it currently is.

## Out of scope
- No backend, DB, or RLS changes.
- No changes to B2C customer views.
- No new data fetching — everything derives from the existing `ordersAnalytics` query.
