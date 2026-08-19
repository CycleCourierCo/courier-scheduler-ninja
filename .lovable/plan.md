# Unified order cards on desktop

Make the dashboard order list use the same card UI on desktop as on mobile, and drop the column management controls.

## Changes

1. `src/components/OrderListContainer.tsx`
   - Render `OrderCardList` at every breakpoint; remove the `OrderTable` branch and its import.

2. `src/components/OrderCardList.tsx`
   - Make the card list responsive: single column on mobile, `sm:grid-cols-2 xl:grid-cols-3` grid on larger screens so cards fill the width without stretching.
   - Keep existing content (tracking number, creator, status badge, service badges, bike details, sender/receiver, dates, actions); allow slightly richer spacing at desktop sizes.

3. Column management removal
   - Delete `src/components/OrderTable.tsx` and `src/components/TableColumnSettings.tsx` (only used by the table), since the card view replaces them and column settings no longer apply.

## Notes

Filters, search, pagination and the empty/loading states in `Dashboard.tsx` stay unchanged.
