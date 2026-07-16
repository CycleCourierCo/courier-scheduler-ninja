## Plan

Fix the mobile overflow shown on the Bicycle Inspections page by making the inspection list/card layout responsive instead of keeping desktop row layouts on small screens.

### Changes

1. **Inspection card header**
   - Change the top card header from a forced horizontal `justify-between` layout to `flex-col` on mobile and `sm:flex-row` on larger screens.
   - Add `min-w-0`, wrapping, and safe text breaking to bike titles, tracking/customer names, and metadata so long bike/order/customer strings cannot widen the page.
   - Make the status badge/status dropdown area full-width on mobile, right-aligned only on desktop.

2. **Bike category controls inside cards**
   - Replace the fixed `w-[180px]` category picker wrapper with responsive widths: full-width on mobile, fixed/narrow only from `sm` upwards.
   - Update `BikeCategoryPicker` with `min-w-0` on the trigger and truncate-safe labels.
   - Make its popover mobile-safe like the repair picker: `w-[calc(100vw-1rem)] sm:w-[300px]`.

3. **Tabs and top filters**
   - Make the search/sort row stack cleanly on mobile.
   - Make the tabs area horizontally scrollable or wrap without forcing page width, so long labels like “Inspected & Serviced” do not create body overflow.

4. **Issue/action sections in cards**
   - Add `min-w-0`/`overflow-hidden` to issue rows and nested action sections.
   - Stack pricing/edit/add-issue action buttons on very small screens where needed.
   - Ensure badges, invoice links, and “Inspected by…” rows wrap instead of pushing the card wider.

### Scope

- Frontend layout only.
- No changes to inspection data, statuses, pricing logic, labour catalogue, or permissions.
- Desktop layout remains the same or visually equivalent, with mobile-specific fixes behind responsive classes.