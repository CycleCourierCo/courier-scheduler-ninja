# Pick components while creating a new build

Today "New build" only captures the details, then you have to reopen the build to allocate parts. Add part selection to the creation flow so a build can be created ready-to-go in one pass.

## Flow

The New build dialog becomes two steps:

```text
Step 1 - Details        Step 2 - Parts (optional)
customer, name, SKU     stock list for that customer
brand/model/type        search + category filter
labour, spec notes      tick parts, running parts total
[Next]                  [Back]  [Create build]
```

- Step 2 only loads once a customer is chosen (staff) or immediately for a customer's own build, since available stock is per-customer.
- Parts list uses the same source as the existing picker: components in Birmingham stock with status `stored`.
- Each ticked part shows its category, spec and value; a footer shows "n parts - £x parts total".
- "Create build" creates the build, then allocates the ticked parts (reserving the stock) before closing. If a part was taken by someone else in the meantime, the build is still created and a toast names the parts that could not be allocated.
- Skipping step 2 behaves exactly as today.
- Slot for each part is derived from its category using the existing hotspot mapping, so parts land on the right diagram area.

## Technical notes

- `src/pages/BuildMyBikePage.tsx`: replace the single-panel New build dialog with a stepped dialog; on submit call `createBikeBuild`, then loop `addComponentToBuild` for the selected stock rows, then refresh.
- Reuse `getAvailableComponents(userId, siteId)` from `bikeBuildService` for the step 2 list; no new service functions or migrations needed.
- Extract the selectable stock list from `PickComponentDialog` into a shared `StockPicker` list component so the create dialog and the detail dialog share one implementation (search, "all parts" toggle, checkbox rows).
- Derive slot via a category to hotspot lookup built from `BIKE_HOTSPOTS` in `src/constants/bikeComponents.ts`.
- Keep the mobile width guards already applied (`max-w-[calc(100vw-2rem)]`, `min-w-0` wrappers) on the new stepped dialog.

Stored-build templates keep working unchanged; this only adds ad-hoc part picking at creation time.
