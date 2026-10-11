# Load onto van in one go (server side)

## Problem
"Load All onto Van" and the "Load selected" dialog on the Loading page save each bike one at a time and reload the whole page after every bike. With 20+ bikes the page is locked up until the last one finishes.

## What changes
- Pressing **Load All onto Van** (or loading several bikes from the dialog) sends all the bikes to the server in a single request. The server marks them all loaded at once.
- The page refreshes **once** at the end, not after every bike.
- The button shows "Loading…" and the bikes move to "Loaded" straight away, so staff can carry on using the page (search, labels, storage) while it saves.
- One summary message: "Loaded 18 bikes onto van (2 skipped: no driver assigned)". If anything fails, the bikes go back to pending and the message says which ones.
- Single-bike "Load" buttons keep working as now, but use the same server action (still one refresh).

Same rules as today: bike marked loaded with time, cleared from storage bay, "held by driver after failed delivery" marker cleared. Cancelled or delivered jobs are skipped.

## Technical details
- New migration: `public.load_orders_onto_van(p_order_ids uuid[])` SECURITY DEFINER, `search_path=public`; checks caller has admin/loader/route_planner role via `user_roles` (matches existing loading-page access); single `UPDATE orders SET loaded_onto_van=true, loaded_onto_van_at=now(), held_by_driver_name=null, held_by_driver_at=null, storage_locations=null, updated_at=now() WHERE id = ANY(p_order_ids) AND status NOT IN ('cancelled','delivered')`; returns loaded ids. Max 500 ids. `REVOKE ALL FROM public, anon; GRANT EXECUTE TO authenticated`.
- `LoadingUnloadingPage.tsx`: new `loadOrdersOntoVan(ids)` calling the RPC with optimistic local state update, single `fetchData()` after; Load All button and `handleRemoveAllBikesFromOrder` use it; busy state disables only the button.
- `RemoveBikesDialog.tsx`: pass the whole selection to a new `onLoadOrders(ids)` prop instead of the sequential loop; close dialog immediately.
- Record the rule in AGENTS.md (bulk van loading goes through one server-side function).
