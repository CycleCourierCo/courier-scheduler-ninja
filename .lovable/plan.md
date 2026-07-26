# Edit bike quantity on an order

Extend the existing admin "Edit Bikes" dialog on the order detail page so the number of bikes can be changed, not just each bike's brand/model/type.

## UI changes — `src/components/order-detail/ItemDetails.tsx`

- Add a "Number of Bikes" `Select` (1–8, matching the create-order form) at the top of the dialog body.
- Changing quantity resizes `editBikes`:
  - Increase: append empty rows `{ brand: "", model: "", type: "" }`.
  - Decrease: truncate from the end (with a confirm if any trimmed rows have data, to avoid accidental loss).
- Existing per-bike rows render from the resized array unchanged.
- Add an "Add bike" button and per-row "Remove" button as a convenience (keeping min 1, max 8).

## Save path — `src/services/orderService.ts`

Update `updateOrderBikes` to also persist the new count:

- Accept the bikes array as today (length is the new quantity).
- In the `orders` update, also set `bike_quantity: bikes.length` alongside `bikes`, `bike_brand`, `bike_model`.
- No signature change needed for callers — quantity is derived from array length.

## Out of scope

- No changes to pricing, invoicing, Shipday, or scheduling flows. They already read `bike_quantity` / `bikes` from the order, so they will pick up the new value on next read.
- No migration — `bike_quantity` column already exists.
- Non-admin UI unchanged (button is admin-only today).
