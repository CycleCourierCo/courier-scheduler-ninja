# Add "Missing Dates" filter to Dashboard

Add a quick filter on the Orders dashboard so the logistics manager can surface orders where the sender and/or receiver have not yet chosen their availability dates — making chase-up calls easy.

## What the user sees

A new filter chip/toggle group in `OrderFilters` (alongside Status / Bike Type) labelled **"Missing availability"** with three options:

- **Sender dates missing** — orders where `pickup_date` is null or an empty array
- **Receiver dates missing** — orders where `delivery_date` is null or an empty array
- **Either missing** — orders missing at least one of the two

Selecting an option filters the orders list. A "Clear" action removes it. Counts continue to flow through the existing pagination.

## Technical changes

1. **`src/services/orderService.ts`**
   - Extend `OrderFilters` interface with `missingDates?: 'sender' | 'receiver' | 'either'`.
   - In `getOrdersWithFilters`, translate it into Supabase filters:
     - `sender` → `.or('pickup_date.is.null,pickup_date.eq.{}')`
     - `receiver` → `.or('delivery_date.is.null,delivery_date.eq.{}')`
     - `either` → `.or('pickup_date.is.null,pickup_date.eq.{},delivery_date.is.null,delivery_date.eq.{}')`
   - Also exclude terminal statuses (`delivered`, `cancelled`) when this filter is active so completed orders don't pollute the list.

2. **`src/components/OrderFilters.tsx`**
   - Add a new control (Select or small ToggleGroup) for "Missing availability" with the three options + "Any".
   - Include `missingDates` in the filter state passed up via `onFilterChange`.

3. **`src/pages/Dashboard.tsx`**
   - Add `missingDates` to the `filters` state, `handleFilterChange`, `handleClearFilters`, and pass it into `getOrdersWithFilters`.

## Out of scope

- No DB schema changes.
- No changes to scheduling / availability email flows.
- No new analytics or counts on the header — purely a filter.
