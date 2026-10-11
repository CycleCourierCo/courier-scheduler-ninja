# Stop the page refresh when assigning a bike to a bay

## Why it happens today

Every bay action on the Loading page (assign to a bay, remove from a bay, clear a bay position, move a bike between bays) ends with `await fetchData()` — a full reload of every order on the page. That reload rebuilds all the lists from scratch, which collapses/reshuffles the sections and loses your scroll position. It's not needed: we already know exactly what changed, so we can update just that bike on screen.

The bulk "Load onto van" already works this way (updates the bikes on screen, no full reload) — this plan brings the bay actions in line with it.

## What changes

In `src/pages/LoadingUnloadingPage.tsx`, replace the full `fetchData()` reload with a targeted on-screen update in each of these four actions:

1. **Assign bike(s) to a bay** (`handleAllocateStorage`)
   - After the save succeeds, update that order on screen: add the new bay allocations to its `storage_locations` and clear the "held by driver" fields — no page reload.
2. **Remove from storage / load onto van** (`handleRemoveFromStorage`)
   - Update the order on screen: remove the allocation; if it was the last one, mark it as loaded onto the van.
3. **Clear bay position** (`handleClearBayPosition`)
   - Update the order on screen: remove the allocation only.
4. **Move bike to another bay** (the move handler around line 491)
   - Update the order on screen with the new bay/position.

Behaviour stays identical otherwise:
- The "bay already occupied" check still runs before saving.
- Warehouse-storage bikes still get added to Warehouse Stock.
- If a save fails, nothing changes on screen and you still get the error message.
- Success messages unchanged.

## Result

Assigning, moving or clearing a bay updates instantly in place — the page no longer reloads, your scroll position and open sections stay put, and you can allocate several bikes in a row without waiting.

## Technical notes

- Only `src/pages/LoadingUnloadingPage.tsx` changes; no database or server changes.
- Pattern mirrors the existing optimistic update in the bulk van-load handler (`setOrders(prev => prev.map(...))`), plus matching updates to the `storageAllocations` list where needed.
- Verified with a typecheck/build; signed-in testing on a real bay isn't possible from here, so a quick try on the real page is the final check.
