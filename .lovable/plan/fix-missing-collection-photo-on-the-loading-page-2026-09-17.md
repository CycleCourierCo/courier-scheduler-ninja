# Fix missing collection photo on the loading page

The order `CCC754843621948PAUEX8` has a collection photo in Shipday tracking events, but the photo event is attached to an older pickup job id while the order now stores a newer pickup id.

The shared collection-photo helper already handles this by trusting the `leg: "pickup"` marker first. Parts of the loading page use that helper, but the search result thumbnail still uses an older exact-pickup-id check, so it misses this order's photo.

## What will change

- Update the loading page bike search result thumbnail to use the shared collection-photo helper.
- Keep the existing click-through behaviour: the thumbnail opens the photo in a new tab.
- Keep the existing fallback: if there is no collection photo, no thumbnail is shown.
- Check the other loading page photo buttons still use the shared helper, so this same mismatch does not hide photos elsewhere on the page.

## Technical notes

- Change `src/components/loading/BikeSearchSection.tsx` to import `getOrderCollectionPhotos` from `src/utils/collectionPhotos`.
- Replace the inline `pickup_id === orderId` photo lookup with `getOrderCollectionPhotos(order)[0]`.
- This is a display-only fix: no database change, no Shipday change, no photo data change.
- Validate with typecheck and, if possible, search the loading page for `CCC754843621948PAUEX8` to confirm the thumbnail appears.
