## Add bike type editing to Item Details

In `src/components/order-detail/ItemDetails.tsx`, the admin "Edit Bikes" dialog currently only edits **Brand** and **Model**. Extend it so **Type** can also be changed.

### Changes

1. **Edit Bikes dialog** (`ItemDetails.tsx`)
   - Add a Type `Select` field next to Brand/Model for each bike, using the same `BIKE_TYPES` list used in `src/components/create-order/OrderDetails.tsx` (extract it into a shared constant or import from a shared location — reusing `BIKE_TYPE_BY_ID` from `src/constants/bikePricing.ts` is the cleanest fit since it already contains the canonical type names).
   - Update the dialog layout to accommodate three fields per bike (e.g. stack Type below Brand/Model on narrow widths).
   - Wire the new field into the existing `editBikes` state.

2. **Save flow**
   - `updateOrderBikes` in `src/services/orderService.ts` already accepts `{brand, model, type, value}` per bike, so no service change is needed — the `type` will now flow through when the admin edits it.

### Notes

- Purely a UI enhancement to the existing admin edit dialog; no DB or backend changes.
- Keeps parity with the type list used at order creation so downstream pricing/invoicing continues to match.