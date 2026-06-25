## Why loaders hit "Bay must be A, B, C, or D" while admins don't

Verified the permission model — it is **not** an RLS issue:

- `storage_bays` SELECT policy: `is_internal_staff(auth.uid())`, which already includes `loader` (alongside admin, cs_agent, route_planner, driver, sales, timeslip_admin, mechanic).
- `has_table_privilege('authenticated', 'public.storage_bays', 'SELECT')` returns `true`.

So the `useStorageBays()` hook returns Bay E for loaders just like it does for admins.

The real cause is that two of the loader-facing components still hardcode `["A","B","C","D"]` in their client-side validation, while the admin-facing `PendingStorageAllocation.tsx` and `BikesInStorage.tsx` were already migrated to the dynamic list. So admins assigning via the pending-allocation panel succeed, but loaders going through the bike-search or order-detail flows get blocked client-side before the request hits the DB.

## Fix (frontend only)

1. **`src/components/order-detail/StorageLocation.tsx`** — use `useStorageBays()` and validate against `bays.map(b => b.label.toUpperCase())`; surface the configured labels in the toast and bay-input label; cap position by the matched bay's `position_count` (fallback to 20 if not loaded yet).

2. **`src/components/loading/BikeSearchSection.tsx`** — same: replace both hardcoded `["A","B","C","D"]` checks (allocate flow + move flow) with the dynamic `validBayLabels`, and use each bay's `position_count` for the position cap.

3. **`src/pages/LoadingUnloadingPage.tsx`** (sorting only, ~line 1244) — replace the fixed `['Bay A','Bay B','Bay C','Bay D']` sort order with `configuredBays.map(b => 'Bay ' + b.label)` (display_order) so new bays group correctly instead of falling into the alphabetical tail.

No DB, RLS, or grant changes. Pure client-side validation/sorting cleanup so loaders accept any configured bay.
