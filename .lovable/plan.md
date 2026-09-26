# Edit warehouse stock items

## What you'll get
On the Warehouse Stock page, every stock row gets an **Edit** (pencil) button next to the existing delete button. Clicking it opens the same form used for "Add Stock", pre-filled with that item's details, so an admin can change:

- Which customer the item belongs to
- Item type (complete bike / component), brand, model, bike type, frame size, spec, quantity
- Value, SKU, notes
- Bay and position

Saving updates the item in place and refreshes the list. The customer's own "My Stock" view reflects the changes automatically since it reads the same record.

## How it works
- The Add Stock dialog is reused for editing: its title switches to "Edit Stock Item" and the save button says "Save changes" when editing.
- Editing a whole bike still checks the bay/position isn't taken — but ignores the item's own current slot, so you can save without moving it.
- Only admins see the Warehouse Stock page, so no new permissions are needed; the existing admin update rule on the stock table already allows this.
- No database changes required.

## Technical details
- `src/pages/WarehouseStockPage.tsx`: add `editingItem` state, an Edit button per row, pre-fill `formData` from the item, and branch `handleSubmit` between add and update.
- `src/services/warehouseStockService.ts`: reuse the existing `updateWarehouseStock` (already present) and `checkLocationConflict` with its `excludeId` parameter.
- Verify with a typecheck and a quick browser pass on the page.
