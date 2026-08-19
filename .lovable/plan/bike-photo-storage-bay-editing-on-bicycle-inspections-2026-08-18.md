# Bike photo + storage bay editing on Bicycle Inspections

Two additions to the inspections cards: a thumbnail of the bike taken at collection, and the ability to change which bay the bike sits in without leaving the page.

## 1. Small bike picture

Collection photos already exist on each order — the driver's proof-of-delivery images are stored inside the order's tracking events by the Shipday webhook, and the Loading page already renders them as 80x80 thumbnails.

- Pull that extraction logic out into a shared helper so both pages use the same rule: find the completed/POD-upload event for the collection leg and return its photo URLs.
- On each inspection card, show the first photo as a small rounded thumbnail next to the bike name.
- Clicking the thumbnail opens a dialog with all collection photos at full size.
- If the bike hasn't been collected yet (no photos), nothing is shown — the card layout stays as it is.

## 2. Change storage bay from the inspection page

Currently the card only displays the bay badge (e.g. "A3") read-only.

- Reuse the same bay/position editor used on the Loading page: bay letter + position number per bike, handling orders with multiple bikes (each bike gets its own bay/position row).
- Add an edit action on the bay badge area, visible to staff who can manage inspections.
- Saving writes the updated locations back onto the order and refreshes the inspection list, so the Loading page and inspections page stay in sync.
- If the bike has no allocation yet, the same dialog allows allocating one.

## Technical notes

- New `src/utils/collectionPhotos.ts` — `getCollectionPhotos(trackingEvents)` returning `string[]`; `BikeSearchSection.tsx`, `PendingStorageAllocation.tsx` and `BikesInStorage.tsx` are refactored to call it (no behaviour change).
- New shared `src/components/loading/ChangeStorageLocationDialog.tsx` extracted from the existing inline dialog in `BikesInStorage.tsx`, driven by a list of `{ bay, position }` values, so both pages use one implementation.
- `BicycleInspections.tsx`: thumbnail + photo dialog + bay edit trigger; mutation updates `orders.storage_locations` (preserving existing allocation ids/metadata) and invalidates the pending-inspections query.
- `getPendingInspections` already selects `storage_locations` and `tracking_events`, so no service/query changes are needed.
- No database migration required.
