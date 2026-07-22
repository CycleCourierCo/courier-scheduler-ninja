
## What I found in the database

- **121 B2B profiles** exist (120 approved, 1 pending) — matches your Account Approvals page.
- Of those, only **106 have ever placed an order**, so the leaderboard's realistic upper bound is 106 (the other ~15 approved accounts have no orders yet and legitimately wouldn't appear).
- But the leaderboard is currently showing **~870 rows**, because **900 B2B orders have no `company_name` on their profile** and the code falls back to `order.sender.name`. Since the sender name is typed into the booking form and differs per shipment, every shipment gets its own row.
- **Shopify customers** don't appear because grouping is done by `company_name || sender.name` and the underlying profiles aren't flagged `is_business = true` / role `b2b_customer`, so they get filtered out.

Code involved: `src/services/analyticsService.ts` → `getAllCustomersAnalytics` (grouping + B2B filter) and `fetchOrdersForAnalytics` (the join it depends on).

## Plan

### 1. Group by customer identity, not sender name

In `getAllCustomersAnalytics` (and `getTopCustomersAnalytics` for consistency), change the grouping key from `companyName || sender.name` to a stable customer identifier:

- Primary key: `order.userId` (profile id).
- Display name resolution: `profiles.company_name` → `profiles.name` → `profiles.email` → `sender.name` (last one only used if `userId` is null, e.g. very old public bookings).
- Aggregate order counts against the `userId` key so every order from the same customer collapses into one row.

Expected result: leaderboard drops from ~870 rows to ≈106 (the B2B accounts that have placed at least one order, out of 121 total).

### 2. Include Shopify (and other integration) customers

Broaden the B2B classification. A customer counts as B2B if **any** of these is true:

- `profiles.is_business = true`
- `profiles.role = 'b2b_customer'`
- The user has a row in `customer_shopify_stores` (Shopify-connected).
- The user has any active row in `api_keys` (API-integration customer).

Implementation: extend `fetchOrdersForAnalytics` to also select `customer_shopify_stores(id)` and `api_keys(id, is_active)` via the profile relation, then compute an `isB2B` flag on the mapped order using the OR of all four signals. Update `getAllCustomersAnalytics`, `getTopCustomersAnalytics`, and `getCustomerTypeAnalytics` to read that flag instead of recomputing inline.

### 3. Update the leaderboard component

`src/components/analytics/B2BLeaderboard.tsx` currently keys rows and selection by `customerName`. Extend the `CustomerOrderCount` type with an optional `customerId`, and use `customerId ?? customerName` as the React key and as the identifier passed to `CustomerOrdersDialog`. Update `CustomerOrdersDialog` to filter orders by `customerId` when present so opening a row still shows the correct order history.

### 4. Sanity check after change

Verify in the UI that:
- Leaderboard row count is ≈106 (matches B2B accounts that have placed orders; the remaining ~15 of 121 approved accounts have no orders yet).
- Known Shopify customers appear with their expected order counts.
- Clicking a row still opens the correct order history.

### Files touched

- `src/services/analyticsService.ts` — grouping, B2B classification, fetch join.
- `src/components/analytics/B2BLeaderboard.tsx` — key/selection by id.
- `src/components/analytics/CustomerOrdersDialog.tsx` — id-based order lookup.

No database migrations required.
