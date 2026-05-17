## Add Inline Bike Search Section on Loading Page

Add a dedicated **Find a Bike** section directly above the Pending Storage Allocation list. Searching surfaces the matching bike inline with the same actions the user would get in the regular lists.

### What the user sees

1. New card titled **Find a Bike** at the top of the Loading & Storage page, above Pending Storage Allocation.
2. A single search input (with search icon and clear button). Placeholder: *"Search by customer name, bike, or tracking number…"*.
3. As the user types (debounced), matching in-progress bikes appear as result cards below the input. "In-progress" = collected, not delivered, not cancelled.
4. Each result card shows:
   - Customer name (sender + receiver)
   - Bike(s) — brand/model from the `bikes` JSONB snapshot
   - Tracking number / order ID
   - A status badge: **Pending Allocation**, **In Storage – Bay X##**, or **On Van**
   - Scheduled delivery date
5. Action buttons per result, based on current state:
   - **Pending Allocation** → `Load onto Van` and `Allocate to Storage` (opens the existing bay/position picker reused from `PendingStorageAllocation`)
   - **In Storage** → `Load onto Van` (clears storage + marks loaded) and `Move Location`
   - **On Van** → `Unload from Van` (returns it to pending)
6. After any action the page data refetches and the result card reflects the new state.
7. Empty input → section shows a hint, no results list. No matches → "No bikes found".

### Technical notes

- New component: `src/components/loading/BikeSearchSection.tsx`.
  - Props: `orders`, `storageAllocations`, `onAllocateStorage`, `onLoadOntoVan` (`handleRemoveAllBikesFromOrder`), `onRemoveFromStorage`, `onUnloadFromVan`, `onChangeLocation`.
  - Local state: `query` (debounced ~200ms).
- Search candidate set = union of `collectedBikes`, orders in `bikesInStorage`, and `bikesLoadedOntoVan` (already computed in `LoadingUnloadingPage.tsx`).
- Case-insensitive match against:
  - `sender.name`, `receiver.name`
  - `bikeBrand`, `bikeModel`, and each entry in `bikes[]` (`brand`, `model`) per Order Item Display Logic memory
  - `trackingNumber` and `id`
- Helper `getOrderLocationState(order)` returns `'pending' | 'storage' | 'van'` plus, for storage, the list of `StorageAllocation` rows for that order.
- Render in `LoadingUnloadingPage.tsx` immediately above `<PendingStorageAllocation … />`.
- Reuse the existing storage allocation picker UI rather than rebuilding it (extract a small `AllocatePopover` from `PendingStorageAllocation` if needed, or import and reuse the existing dialog component).
- No backend, schema, RLS, or edge function changes. All data already loaded on the page.
- Styling uses existing semantic tokens — no hardcoded colours.

### Out of scope

- Searching delivered/cancelled orders.
- Bulk actions on multiple search results.
