

# Show Bikes Loaded onto Van in Pending Storage Allocation Section

## Overview
Enhance the Pending Storage Allocation tab to also display bikes that have been loaded onto a van but have not yet been delivered. These bikes will be displayed with a different UI - showing just their details and "Loaded onto Van" status without allocation inputs or allocate buttons.

This allows tracking exactly how many bikes are in each driver's van, including those that may not get delivered on the route.

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/LoadingUnloadingPage.tsx` | Add new `bikesLoadedOntoVan` list and pass to PendingStorageAllocation |
| `src/components/loading/PendingStorageAllocation.tsx` | Accept new prop and render loaded bikes with different UI |

## Implementation Details

### 1. LoadingUnloadingPage.tsx Changes

Add a new filtered list for bikes that are loaded onto van but not delivered:

```typescript
// Get bikes that are loaded onto van but not yet delivered
const bikesLoadedOntoVan = orders.filter(order => {
  const hasDelivery = hasBeenDelivered(order);
  const isCancelled = order.status === 'cancelled';
  const isLoadedOntoVan = order.loaded_onto_van;
  
  return isLoadedOntoVan && !hasDelivery && !isCancelled;
});
```

Pass this to the PendingStorageAllocation component:
```tsx
<PendingStorageAllocation 
  collectedBikes={collectedBikes}
  bikesLoadedOntoVan={bikesLoadedOntoVan}  // NEW PROP
  storageAllocations={storageAllocations}
  onAllocateStorage={handleAllocateStorage}
/>
```

### 2. PendingStorageAllocation.tsx Changes

**Updated Props Interface:**
```typescript
interface PendingStorageAllocationProps {
  collectedBikes: Order[];
  bikesLoadedOntoVan: Order[];  // NEW PROP
  storageAllocations: StorageAllocation[];
  onAllocateStorage: (orderId: string, allocations: { bay: string; position: number; bikeIndex: number }[]) => void;
}
```

**Render Logic:**
- Group both `collectedBikes` AND `bikesLoadedOntoVan` by driver (using `delivery_driver_name` for loaded bikes)
- For `collectedBikes`: Show existing UI with allocation inputs and buttons
- For `bikesLoadedOntoVan`: Show simplified card with:
  - Bike details (sender name, brand/model, tracking number)
  - "Loaded onto Van" badge (purple/green styling)
  - Print Label and See Image buttons (keep these)
  - NO allocation inputs or allocate button

**Visual Differentiation:**
- Bikes pending allocation: Current card styling with allocation inputs
- Bikes loaded onto van: Card with a subtle "loaded" indicator, possibly different background tint

## UI Layout for Loaded Bikes

```
+--------------------------------------------------+
| [Driver Name] - X bikes                          |
+--------------------------------------------------+
| Bike Card (LOADED - no allocation inputs)        |
|   Customer Name                                  |
|   Bike Brand Model                               |
|   Tracking: CC-XXXXX                             |
|   [Loaded onto Van] badge (green)                |
|   [Print Label] [See Image]                      |
+--------------------------------------------------+
| Bike Card (PENDING - with allocation inputs)     |
|   Customer Name                                  |
|   (... existing allocation UI ...)               |
+--------------------------------------------------+
```

## Data Flow

1. `LoadingUnloadingPage` creates two separate lists:
   - `collectedBikes`: Collected, not in storage, not loaded onto van
   - `bikesLoadedOntoVan`: Loaded onto van, not delivered yet

2. Both lists passed to `PendingStorageAllocation`

3. Component groups all bikes by driver and renders appropriately based on their status

## Empty State
Update the empty state message to reflect that there are no bikes pending allocation OR loaded onto van.

