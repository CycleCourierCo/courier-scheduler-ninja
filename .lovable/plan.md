## 1. "Load All onto Vans" button (loading list)

**Location:** Top of `PendingStorageAllocation` (above the driver groups), so it's visible on the loading page for the currently-displayed day.

**Behaviour:**
- Button labelled `Load All onto Vans` with a `Truck` icon.
- Shows the total count of pending bikes (`collectedBikes` with `delivery_driver_name` assigned).
- Disabled when no eligible bikes exist.
- On click, opens an `AlertDialog` confirmation: "Load all N bikes onto their assigned vans?" — to prevent mis-taps.
- On confirm, iterates every bike in `collectedBikes` that has a `delivery_driver_name` and calls the existing `onLoadOntoVan(bike.id)` handler for each (same as the per-bike button), then shows a single toast `Loaded N bikes onto vans`.
- Bikes without an assigned delivery driver are skipped (matches per-bike behaviour where the individual Load button only renders when a driver is assigned).

**Files:**
- `src/components/loading/PendingStorageAllocation.tsx` — add the button + confirm dialog at the top of the returned JSX.

No new props or backend changes — reuses the existing `onLoadOntoVan` handler in `LoadingUnloadingPage.tsx`.

## 2. Bike photo in search results

**Location:** `BikeSearchSection.tsx` result cards.

**Behaviour:**
- Reuse the existing collection-image extractor (copy `getCollectionImages` helper from `PendingStorageAllocation.tsx` — pulls POD URLs from `trackingEvents.shipday.updates`).
- For each search result, show the first collection photo as a small thumbnail (~64×64, rounded, object-cover) on the left of the card header.
- If no photo is available, show a placeholder `Image` icon in the same slot so layout stays consistent.
- Clicking the thumbnail opens the full image in a dialog (same pattern as `PendingStorageAllocation`'s image dialog), so users can verify the bike at a glance.

**Files:**
- `src/components/loading/BikeSearchSection.tsx` — add helper, thumbnail in the card, and image dialog state.

No backend or type changes.
