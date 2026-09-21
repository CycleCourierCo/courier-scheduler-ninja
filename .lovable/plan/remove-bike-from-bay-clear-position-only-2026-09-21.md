# Remove bike from bay (clear position only)

On the Loading page's "Bikes in storage" cards, add an X button that removes a bike from its bay slot without loading it onto a van.

## What changes

1. **X button per bay badge** — `src/components/loading/BikesInStorage.tsx`
   - Each bay/position badge (e.g. `B4`) in the card header gets a small X (cross) button beside it.
   - Single-bike orders get one X; multi-bike orders get one per badge so individual slots can be cleared.
   - Clicking X opens a confirmation before anything changes.

2. **Confirmation dialog** — uses the existing `notify.confirm` pattern:
   - Title: "Remove from Bay B4?"
   - Message: names the customer and bike, explains the bike stays on the order but loses its storage position and will need re-allocating before loading.
   - Destructive "Remove" confirm button / Cancel.

3. **Clear-position logic** — new `handleClearBayPosition(allocationId)` in `src/pages/LoadingUnloadingPage.tsx`:
   - Removes just that allocation from the order's `storage_locations` JSONB (sets it to null when the last one is cleared).
   - Unlike the existing "Load onto Van" flow, it does **not** set `loaded_onto_van`, `loaded_onto_van_at`, or touch driver fields — the order keeps its current delivery state and re-appears in the pending-allocation list so it can be slotted again.
   - Success/error toasts, then refreshes data so the bay grid and card update.

## Technical notes

- Storage allocations live on `orders.storage_locations` (JSONB array); no database migration needed.
- The existing "Load onto Van" and "Load All" buttons are unchanged.
- No permission changes — same staff who see the Loading page can use it.
- Verify with the typecheck/build after editing.
