## What "load into van" does today (verified in `src/pages/LoadingUnloadingPage.tsx`)

Two handlers, both the same shape:

- `handleRemoveFromStorage` (single bike, line ~302): removes that allocation from the `storage_locations` array; if it was the last one, sets `storage_locations: null`, `loaded_onto_van: true`, `loaded_onto_van_at: now()`.
- `handleRemoveAllBikesFromOrder` (whole order, line ~348): sets `loaded_onto_van: true`, `loaded_onto_van_at: now()`, and `storage_locations: null` when the order had allocations.

So: **no, the storage location is not kept.** Loading into a van wipes `storage_locations` entirely; the only trace left is `loaded_onto_van_at`. (`handleUnloadFromVan` flips `loaded_onto_van` back to false but does not restore the bay — it comments that `loaded_onto_van_at` is deliberately kept as a history marker.)

That means bay-usage history isn't actually being retained today for normal jobs either — which is worth knowing given your analytics point.

## Confirmed cause of the 4 stuck bikes

Box My Bike / Foam My Bike have no equivalent of that step. `updateStage` in `src/pages/BoxMyBikePage.tsx` only writes `box_my_bike_status` + a stage timestamp and fires webhooks — nothing touches `storage_locations`. Same in `src/components/boxmybike/FoamMyBikeSection.tsx`. Plus `getOrdersForLoading()` in `src/services/orderService.ts` excludes only `cancelled` and `delivered`, so `delivered_by_3p` orders keep appearing in the storage view.

## Plan — mirror the van behaviour

**1. Release the bay on 3rd-party / ferry hand-off**
- `BoxMyBikePage.tsx` `updateStage`: when advancing to `collected_by_3p`, also set `storage_locations: null` — exactly what loading into a van does. Only on forward moves, never on a stage rollback.
- `FoamMyBikeSection.tsx`: same on its ferry hand-off stage (`delivered_to_ferry` / collected for the ferry leg).
- Toast wording mirrors the van one: "Bike collected by courier and removed from storage".

**2. Safety net so the storage view can't show departed bikes**
- `getOrdersForLoading()`: also exclude `delivered_by_3p`, `collected_by_3p`, `delivered_to_ferry`.
- `hasBeenDelivered()` in `LoadingUnloadingPage.tsx` and the matching helper in `src/components/order-detail/StorageLocation.tsx`: treat those three statuses as delivered, so no allocation UI or "in storage" badge appears (this also stops the re-allocation that put Archie Lamburne back into N20 after delivery).

**3. The 4 existing bikes**
- No data wipe. Step 2 alone makes N8/N15/N19/N20 stop showing as occupied, and their `storage_locations` records stay in place. Going forward, step 1 releases the bay at hand-off just like the van flow.

**4. Bay-usage analytics — a separate, additive idea**
Since both the van flow and this new flow null out the field, bay history is being lost either way. If you want the "which bays are used most" analysis, the clean fix is an append-only `storage_bay_history` log (order id, bay, position, allocated_at, released_at, release reason: van / 3rd-party / ferry / manual) written whenever an allocation is created or released. That preserves history properly instead of relying on stale live rows. Say the word and I'll fold it in — otherwise I'll implement steps 1–3 only.

## Technical notes
- Files: `src/pages/BoxMyBikePage.tsx`, `src/components/boxmybike/FoamMyBikeSection.tsx`, `src/services/orderService.ts`, `src/pages/LoadingUnloadingPage.tsx`, `src/components/order-detail/StorageLocation.tsx`.
- Steps 1–3 need no schema change. Step 4 would add one new table with RLS + grants.
