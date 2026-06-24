## Goal
Let admins define the storage bays (letter + slot count) instead of hardcoded A–D × 20. The Loading page grid, Warehouse Stock page, and bike allocation flows then render whatever bays admins have configured.

## What admins get
A new **Storage Bays** admin page (linked from User Management / admin nav) where they can:
- Add a bay: letter/label (e.g. `K`) + number of positions (e.g. `10`)
- Edit a bay's position count
- Reorder bays (display order)
- Deactivate/delete a bay (blocked if any active allocations/stock exist there)

## Database
New table `storage_bays`:
- `label` (text, unique, uppercase)
- `position_count` (int, 1–100)
- `display_order` (int)
- `is_active` (bool)
- standard timestamps

RLS: admins manage; internal staff (loader, route_planner, cs_agent, driver, mechanic) can read. Seeded with existing A/B/C/D × 20 so nothing breaks on day one.

## Frontend changes
- New hook `useStorageBays()` fetching active bays ordered by `display_order`.
- `StorageUnitLayout` (loading page grid): replace hardcoded `bays`/`positions` with data from the hook; each bay renders its own `position_count` slots.
- `WarehouseStockPage`: replace `BAYS` and `POSITIONS` constants; the position dropdown becomes dependent on the selected bay.
- `BikesInStorage` and `PendingStorageAllocation`: replace the `['A','B','C','D']` validation with a dynamic set + per-bay max position check.
- New admin page `src/pages/StorageBaysPage.tsx` with add/edit/delete UI, plus a route + nav entry visible to admins only.

## Out of scope
- No changes to existing allocation data.
- No multi-warehouse concept — single shared bay list.

```text
Admin Settings → Storage Bays
 ┌──────────────────────────┐
 │ A   20 slots   [edit][x] │
 │ B   20 slots   [edit][x] │
 │ K   10 slots   [edit][x] │
 │ [+ Add bay]              │
 └──────────────────────────┘
```
