## 1. Loader access to Box My Bike

**`src/components/ProtectedRoute.tsx`** — extend the `loader` allow-list on line 142 to include `isBoxMyBikePage`:
```ts
if (r === 'loader' && (isLoadingPg || isTasksPage || isBoxMyBikePage)) anyAllowed = true;
```

**`src/pages/BoxMyBikePage.tsx`** — include loader in the staff check so loaders see the staged tabs and controls, not the customer view:
```ts
const isStaff = hasRole(userProfile, "admin") || hasRole(userProfile, "mechanic") || hasRole(userProfile, "loader");
```

## 2. Hide bike prices on Loading & Storage from non-admins

Only admins should see `£value` on bikes. Gate every price render with `hasRole(userProfile, 'admin')`:

- **`src/components/loading/PendingStorageAllocation.tsx`** — lines 203, 218, 308 (driver total value pill + per-bike `• £value`).
- **`src/components/loading/BikesInStorage.tsx`** — line 286 (`order.bikeValue` per-bike suffix).
- **`src/pages/LoadingUnloadingPage.tsx`** — lines 1406 and 1430 (`Total value: £…` strings on the driver messaging summaries).
- **`src/pages/WarehouseStockPage.tsx`** — hide any rendered `bike_value` columns/cells and the "Value (£)" form field for non-admins (create form stays admin-only anyway; verify list rendering hides value column for non-admins).

Each component already receives `userProfile` via `useAuth()` where used, or needs a small `useAuth()` import. No changes to services, queries, or DB.

## 3. Bicycle Inspections — admin repair totals + approved/declined counts

**`src/pages/BicycleInspections.tsx`** — inside `renderOrderCard` (around line 703), compute per-order:
```ts
const declinedCount = orderIssues.filter(i => i.status === 'declined').length;
const totalRepairCost = approvedIssues.reduce((s, i) => s + (Number(i.estimated_cost) || 0), 0);
```

Render a small summary row at the top of `CardContent` (before the Issues list, ~line 786):
- Always visible (all roles that already see this card): `Approved: {approvedCount}` and `Declined: {declinedCount}` badges.
- Admin-only (`isAdmin`): `Total repairs: £{totalRepairCost.toFixed(2)}` badge.

Use existing `Badge` component with variants matching the current approved (green) / declined (destructive) styling so it's consistent with the per-issue chips. No backend/RPC changes required — data is already in `orderIssues`.

## Notes
- No migrations, no edge function changes.
- Verification: log in as loader → `/box-my-bike` should load with staged tabs; log in as loader/mechanic on `/loading` → no £ values shown; log in as admin on `/bicycle-inspections` → per-order shows approved/declined counts and total repair £; non-admin roles that view inspections (mechanic) see only approved/declined counts, no £ total.
