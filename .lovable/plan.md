

# Add "Load onto Van" Button for Bikes Pending Storage Allocation

## Overview
Add a "Load onto Van" button for bikes in the Pending Storage Allocation section that have a delivery driver assigned. When clicked, the bike will be marked as loaded and move from the collection driver's list to the delivery driver's "Loaded onto Van" section.

## Current Flow
- Collected bikes appear under the **collection driver** who picked them up
- They show a badge "Load onto {delivery_driver} van" if a delivery driver is assigned
- No action button exists to actually load them onto the van

## Proposed Flow
- Add a "Load onto Van" button (only visible when `delivery_driver_name` exists)
- Clicking it sets `loaded_onto_van: true` and `loaded_onto_van_at: timestamp`
- The bike immediately moves to the delivery driver's "Loaded onto Van" section with green styling

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/loading/PendingStorageAllocation.tsx` | Add `onLoadOntoVan` prop and "Load onto Van" button |
| `src/pages/LoadingUnloadingPage.tsx` | Pass `handleRemoveAllBikesFromOrder` as `onLoadOntoVan` prop |

## Implementation Details

### 1. PendingStorageAllocation.tsx - Add Load onto Van Button

**Update interface (line 32-38):**
```typescript
interface PendingStorageAllocationProps {
  collectedBikes: Order[];
  bikesLoadedOntoVan: Order[];
  storageAllocations: StorageAllocation[];
  onAllocateStorage: (orderId: string, allocations: { bay: string; position: number; bikeIndex: number }[]) => void;
  onUnloadFromVan: (orderId: string) => void;
  onLoadOntoVan: (orderId: string) => void;  // NEW
}
```

**Update component props (line 40-46):**
```typescript
export const PendingStorageAllocation = ({ 
  collectedBikes, 
  bikesLoadedOntoVan,
  storageAllocations, 
  onAllocateStorage,
  onUnloadFromVan,
  onLoadOntoVan  // NEW
}: PendingStorageAllocationProps) => {
```

**Add button to pending allocation cards (after line 334, before the allocation inputs):**
```tsx
{/* Load onto Van button - only show if delivery driver assigned */}
{bike.delivery_driver_name && (
  <Button
    size="sm"
    variant="outline"
    onClick={() => onLoadOntoVan(bike.id)}
    className="h-9 text-xs w-full min-h-[44px] border-success text-success hover:bg-success/10"
  >
    <Truck className="h-3 w-3 sm:mr-1" />
    <span className="ml-1">Load onto {bike.delivery_driver_name} Van</span>
  </Button>
)}
```

### 2. LoadingUnloadingPage.tsx - Pass the Handler

**Update component usage (around line where PendingStorageAllocation is rendered):**
```tsx
<PendingStorageAllocation
  collectedBikes={collectedBikes}
  bikesLoadedOntoVan={bikesLoadedOntoVan}
  storageAllocations={storageAllocations}
  onAllocateStorage={handleAllocateStorage}
  onUnloadFromVan={handleUnloadFromVan}
  onLoadOntoVan={handleRemoveAllBikesFromOrder}  // Reuse existing function
/>
```

## Data Flow

```
1. Bike collected by Sal, assigned to Qam for delivery
   → Shows under Sal's section with "Load onto Qam Van" button

2. User clicks "Load onto Qam Van"
   → handleRemoveAllBikesFromOrder called
   → Sets loaded_onto_van: true, loaded_onto_van_at: timestamp
   → Data refreshed from database

3. Bike now appears in Qam's "Loaded onto Van" section (green card)
   → User can still "Unload from Van" if needed
```

## Visual Preview

**Before clicking:**
```
┌─ Sal ──────────────────────────────────┐
│ 🚲 Customer Bike                       │
│ [Print Label] [See Image]              │
│ [Load onto Qam Van] ← NEW GREEN BUTTON │
│ ┌── Bay/Position Inputs ──┐            │
│ └─────────────────────────┘            │
└────────────────────────────────────────┘
```

**After clicking:**
```
┌─ Qam ──────────────────────────────────┐
│ 🚲 Customer Bike (green highlight)     │
│ ✓ Loaded onto Van                      │
│ [Print Label] [See Image]              │
│ [Unload from Van]                      │
└────────────────────────────────────────┘
```

