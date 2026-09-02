# Frame sizes on stock, stored builds and new builds

Frames get their own size field so the workshop can tell a Medium frame from a Large one, and a build can be created against a chosen bike size.

## How it works

- **Warehouse stock:** when the item is a Frame (or a whole bike), the add/edit form gains a free-text "Frame size" field — type whatever the supplier uses (e.g. `M`, `54cm`, `Large / 56`).
- **Picking:** anywhere a frame size is chosen rather than typed, the dropdown lists only the distinct sizes that already exist on stock rows, so the list stays clean and matches real inventory.
- **Stored builds:** in "Parts needed", a row whose category is Frame shows a "Frame size" dropdown built from those in-stock sizes, saved with that part row.
- **New build:** the details step gains a "Bike size" dropdown (same in-stock size list, free choice, optional). It is stored on the build and shown on the build card and detail dialog next to brand/model.
- Sizes are shown on stock lists and in the parts picker so you can see the size of each frame you tick.
- Existing rows with no size are unaffected and simply show nothing.

## Technical notes

Migration:
- `ALTER TABLE public.warehouse_stock ADD COLUMN frame_size text`
- `ALTER TABLE public.bike_builds ADD COLUMN frame_size text`
- `ALTER TABLE public.bike_build_template_items ADD COLUMN frame_size text`
- No RLS/grant changes needed — columns sit on existing tables.

Code:
- `src/types/warehouseStock.ts` / `src/types/bikeBuild.ts`: add `frame_size` to `WarehouseStock`, `WarehouseStockFormData`, `BikeBuild`, `BikeBuildFormData`, `BikeBuildTemplateItem` and the template form item shape.
- `src/services/warehouseStockService.ts`: persist `frame_size` on create/update, and add `getFrameSizes()` returning distinct non-empty `frame_size` values from `warehouse_stock` (optionally scoped to the customer/site) for the dropdowns.
- `src/pages/WarehouseStockPage.tsx`: free-text "Frame size" input, shown when `item_kind === "bike"` or `component_category === "Frame"`; display the size in the stock list line.
- `src/components/build-my-bike/BuildTemplateDialog.tsx`: for rows where `category === "Frame"`, render a size `Select` populated from `getFrameSizes()`.
- `src/pages/BuildMyBikePage.tsx`: add a "Bike size" `Select` to step 1 of the new-build dialog, pass `frame_size` through `createBikeBuild`, and render it in the build card/list.
- `src/components/build-my-bike/StockPickerList.tsx` and `BuildDetailDialog.tsx`: include the frame size in the part's secondary line so ticked frames show their size.
- `src/services/bikeBuildService.ts`: include `frame_size` in build insert/update and template item save/read.
