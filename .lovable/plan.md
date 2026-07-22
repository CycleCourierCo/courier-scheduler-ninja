Fix mobile layout of the Timeslips filter card so nothing is cramped or clipped.

### Problem
On mobile, all four controls (Driver, Date, Sort, and the two toggles) currently try to sit on one `flex-wrap` row. The `flex-1` + tiny `min-w` values on each wrapper make them shrink to ~80px pills ("A…", "N…") instead of wrapping, and the No mileage / No vehicle switches share a single row that overflows off-screen, hiding "No vehicle".

### Fix — `src/components/timeslips/TimeslipFilters.tsx`
Restructure the filter row so it stacks cleanly on mobile and only becomes a row on larger screens.

- Change the outer container from `flex flex-wrap gap-3 items-center` to a responsive grid:
  - Mobile: single column, full-width controls.
  - `sm`: 2 columns.
  - `lg`: 4 columns (Driver / Date / Sort / Toggles).
- Remove the `flex-1 min-w-*` wrappers on Driver, Date, and Sort — each just becomes a full-width grid cell.
- Move the two toggles into their own cell that stacks vertically on mobile (`flex flex-col gap-3`) and horizontally from `sm` up (`sm:flex-row sm:gap-4`), so "No vehicle" is always visible.
- Move the "Clear Filters" button out of the grid into a row underneath, right-aligned, so it doesn't compete for grid space.

No changes to filter state, props, or `timeslipService` — this is purely presentational.