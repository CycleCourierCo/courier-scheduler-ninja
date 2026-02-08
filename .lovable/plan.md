# Completed Plan

## Fix "Collected (ready to deliver)" Filter & Sync Map with Filters

✅ **COMPLETED**

### Changes Made:

1. **Fixed `isCollected` filter logic** in `RouteBuilder.tsx`:
   - Changed from legacy `collection_confirmation_sent_at` check to `order.order_collected === true`

2. **Lifted filter state to `JobScheduling.tsx`**:
   - Added `filterDate` and `showCollectedOnly` state
   - Created `filteredOrdersForMap` memoized function to filter orders

3. **Updated `RouteBuilder.tsx` props**:
   - Now accepts `filterDate`, `showCollectedOnly`, `onFilterDateChange`, `onShowCollectedOnlyChange` props
   - Uses external state when provided, falls back to internal state for backwards compatibility

4. **Synced ClusterMap with filters**:
   - `JobScheduling.tsx` now passes `filteredOrdersForMap` to `ClusterMap`
   - Both map and route builder update when filters change
