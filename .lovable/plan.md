## Problem

Several places in the loader UI still hardcode the allowed bays as `A, B, C, D`, so assigning to bay `E` (configured in Storage Bays) is rejected with "Bay must be A, B, C, or D". The dynamic bay list from `storage_bays` is already used in some components but not consistently.

Hardcoded spots found:
- `src/components/order-detail/StorageLocation.tsx` (line 81–82): `['A','B','C','D'].includes(...)` + toast.
- `src/components/loading/BikeSearchSection.tsx` (lines 118, 144): same hardcoded check in two places.
- `src/pages/LoadingUnloadingPage.tsx` (line 1242–1244): sort order for grouping uses fixed `['Bay A','Bay B','Bay C','Bay D']`, so a new bay `E` would sort under "other locations".

No DB CHECK constraint restricts the bay value — confirmed via `pg_constraint` on `warehouse_stock`, `orders`, `storage_bays`. The error is purely client-side validation.

## Fix

1. **`src/components/order-detail/StorageLocation.tsx`** — Load bays via `useStorageBays()` (already used elsewhere) and validate `bayUpper` against `bays.map(b => b.label.toUpperCase())`. Update the toast to list the valid labels dynamically (same pattern as `BikesInStorage.tsx`). Also validate `position` against the matched bay's `position_count` instead of any hardcoded max.

2. **`src/components/loading/BikeSearchSection.tsx`** — Replace both hardcoded `["A","B","C","D"]` checks with the dynamic `validBayLabels` from `useStorageBays()`. Update toast text to reflect the configured bays.

3. **`src/pages/LoadingUnloadingPage.tsx`** (group sort, line ~1242) — Replace the fixed `bayOrder` array with the dynamic order derived from `useStorageBays()` (`display_order` ascending, mapped to `Bay <label>`). Falls back to alphabetic for any non-bay group as today.

No DB changes, no schema changes, no backend changes. Pure client-side validation/sorting cleanup so any bay configured on the Storage Bays page is accepted.
