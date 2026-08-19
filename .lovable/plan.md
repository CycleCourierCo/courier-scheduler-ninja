# Retro Box My Bike conversion + tracking JSON in a dialog

Two admin-only changes on the order page.

## 1. Convert an existing order to Box My Bike

- A "Convert to Box My Bike" button appears in the item details area of the order (admin only).
- Clicking it opens a confirmation dialog explaining what changes: the order joins the Box My Bike pipeline and appears on the Box My Bike page.
- The starting stage is picked from where the order already is:
  - not yet collected -> Awaiting depot
  - already collected/at depot -> In depot awaiting boxing
- If the order is already Box My Bike, the button instead reads "Remove from Box My Bike" and clears the flag and stage (label/tracking-link fields are left untouched).
- No invoice is created by this action; billing stays manual as today.

## 2. Tracking events JSON behind a button

- The raw tracking-events JSON editor moves out of the bottom of the page into a dialog.
- A small "Edit tracking JSON" button sits in the tracking timeline card header, visible to admins only.
- Inside the dialog: the JSON textarea, validation on save, Cancel/Save — same behaviour as now, just in a popup.

## Technical notes

- `src/components/order-detail/ItemDetails.tsx` (or a small new `BoxMyBikeConversionCard.tsx` rendered next to it): admin-gated button + `AlertDialog`; update `orders` with `is_box_my_bike` and `box_my_bike_status` (`awaiting_depot` / `in_depot_awaiting_boxing`), then refresh the order.
- Stage choice uses the existing order status / `order_collected` flag; statuses already used by `BoxMyBikePage.tsx`.
- `src/components/order-detail/AdminTrackingEditor.tsx`: wrap existing editor content in a `Dialog` with a trigger button; keep the save/validate logic unchanged.
- `src/pages/OrderDetail.tsx`: render the tracking editor trigger inside/next to `TrackingTimeline` instead of in the admin block at the bottom; keep `NorthernIrelandEditor` and `GuaranteedDeliveryCard` where they are.
