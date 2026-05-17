## Goal
Make the Dashboard filters and search easier to use, prominent, and fully responsive so nothing overflows the viewport.

## Changes (single file: `src/components/OrderFilters.tsx`)

### 1. Prominent search bar (top row, full width)
- Move search out of the cramped flex row onto its own dedicated row at the top.
- Larger sizing: `h-12 text-base pl-12 pr-10`, larger search icon (`h-5 w-5`), and an "×" clear button on the right when there's a value.
- Placeholder kept descriptive: "Search by name, phone, email, postcode, tracking, bike…"
- The "New Order" button moves up next to the search bar (right-aligned on desktop, full-width on mobile) so the action stays one click away.

### 2. Cleaner filter row with active-filter count
- Below the search, a single responsive grid: `grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2` containing Status, Bike Type, Date Range, Sort, Missing Availability (Customer chip added as a 6th cell for admins → `lg:grid-cols-6`).
- Each trigger button uses consistent `h-10` height, icon + truncated label, and a small count badge (e.g. "Status · 3") when filters are active so users can see what's applied without opening the popover.
- "Clear Filters" only shows when at least one filter is active; rendered as a subtle ghost button at the end of the row, never wrapping off-screen.

### 3. Prevent off-screen popovers
- All `PopoverContent` get `align="start"` plus `collisionPadding={16}` and `max-w-[calc(100vw-2rem)]`, and the bike-type/status popovers switch to `w-[min(20rem,calc(100vw-2rem))]` with internal `max-h-[60vh] overflow-y-auto`.
- Replace the nested Popover-inside-Popover for date pickers with a single popover containing a two-month inline `Calendar mode="range"` (no nested triggers that overflow on small screens).

### 4. Active filter chips row (optional, only when filters applied)
- A wrap-friendly row of removable badges under the filter grid summarising every active filter (status values, bike types, date range, customer, missing dates). Click "×" on a chip to remove just that filter.

### 5. No logic/behaviour changes
- All existing handlers (`onFilterChange`, debounce, customer query) stay identical. Only layout, sizing, and popover containment change.

## Technical details
- File touched: `src/components/OrderFilters.tsx` only.
- Uses existing shadcn `Input`, `Button`, `Popover`, `Badge`, `Calendar`, `Select` — no new deps.
- Tailwind responsive classes; semantic tokens (`text-muted-foreground`, `bg-muted`) only — no hard-coded colours.
- The "New Order" button is moved here from its current location in the same row, preserving the `<Link to="/create-order">`.

## Out of scope
- No changes to `Dashboard.tsx`, order list, or services.
- No change to which fields are searched (already handled server-side).
