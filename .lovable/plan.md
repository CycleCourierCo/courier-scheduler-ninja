## Goal
Show where each bike is stored in the depot (bay + position) on the Box My Bike and Foam My Bike boards.

## Current state
- Depot allocations live in the `orders.storage_locations` JSONB column, an array of `{ bay, position, bikeBrand, bikeModel, customerName, allocatedAt, bikeIndex }` (written by `src/components/order-detail/StorageLocation.tsx` and `src/pages/LoadingUnloadingPage.tsx`).
- Neither `src/pages/BoxMyBikePage.tsx` (select at line 105) nor `src/components/boxmybike/FoamMyBikeSection.tsx` (select at line 105) fetch or display it.

## Changes

1. **`src/pages/BoxMyBikePage.tsx`**
   - Add `storage_locations` to the `select()` list and to the `BoxOrder` interface (typed as a loose array).
   - In `renderCard`, next to the existing stage badge, render a location badge per allocation: e.g. `📍 A12` (and `A12, A13` when a multi-bike order occupies several slots). Show `📍 Not allocated` (muted/outline badge) when there are no allocations.

2. **`src/components/boxmybike/FoamMyBikeSection.tsx`**
   - Same: add `storage_locations` to the `select()` and `FoamOrder`, render the same badge in `renderCard`'s header/detail block.

3. **Shared helper** — add a tiny formatter (e.g. `src/utils/storageLocation.ts`) that parses `storage_locations` (handling `null`, string-encoded JSON, and array forms) and returns a sorted list of `"A12"`-style labels, used by both cards so the display stays consistent.

## Notes
- Read-only display; no changes to how allocations are created or cleared.
- Existing behaviour where third-party collection clears `storage_locations` stays as is, so those cards will simply show "Not allocated".
