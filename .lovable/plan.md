

# Fix: "Load onto Van" Button Not Setting Loaded Status for Single Bikes

## Problem Identified
When clicking "Load onto Van" from the Bikes In Storage section for a **single-bike order**, the `handleRemoveFromStorage` function is called. This function only removes the storage allocation but **does NOT set `loaded_onto_van: true`**. 

As a result:
- The bike disappears from storage (storage_locations cleared)
- It reappears in the "Pending Allocation" section under the **collection driver** (not the delivery driver)
- It never shows in the "Loaded onto Van" section

The multi-bike "Load All X" button uses `handleRemoveAllBikesFromOrder` which correctly sets `loaded_onto_van: true`.

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/LoadingUnloadingPage.tsx` | Update `handleRemoveFromStorage` to also set `loaded_onto_van: true` |

## Implementation Details

### LoadingUnloadingPage.tsx - handleRemoveFromStorage Fix

**Current broken code (lines 266-298):**
```typescript
const handleRemoveFromStorage = async (allocationId: string) => {
  // ... finds allocation and order ...
  
  const { error } = await supabase
    .from('orders')
    .update({ storage_locations: updatedAllocations.length > 0 ? updatedAllocations : null })  // ❌ Missing loaded_onto_van!
    .eq('id', allocationToRemove.orderId);
    
  // ...
};
```

**Fixed code:**
```typescript
const handleRemoveFromStorage = async (allocationId: string) => {
  // ... finds allocation and order ...
  
  // Prepare update data - always clear this allocation
  const updateData: any = {
    storage_locations: updatedAllocations.length > 0 ? updatedAllocations : null,
    updated_at: new Date().toISOString()
  };
  
  // If this was the last allocation (storage fully cleared), mark as loaded onto van
  if (updatedAllocations.length === 0) {
    updateData.loaded_onto_van = true;
    updateData.loaded_onto_van_at = new Date().toISOString();
  }
  
  const { error } = await supabase
    .from('orders')
    .update(updateData)
    .eq('id', allocationToRemove.orderId);
    
  // ...
};
```

## Logic Explanation

The fix adds `loaded_onto_van: true` and `loaded_onto_van_at` when the **last** storage allocation is removed. This ensures:

1. Single-bike orders: When the only allocation is removed, it's marked as loaded onto van
2. Multi-bike orders: Only when all allocations are removed does it get marked (for partial loading, you'd use individual allocations)

This matches the behavior of `handleRemoveAllBikesFromOrder` which correctly sets these fields.

## Data Flow After Fix

1. User clicks "Load onto Van" on a single-bike order in storage
2. `handleRemoveFromStorage` is called
3. Storage allocation is removed (`storage_locations: null`)
4. **Now also sets:** `loaded_onto_van: true`, `loaded_onto_van_at: timestamp`
5. Bike appears in "Loaded onto Van" section under the **delivery driver** (not collection driver)

