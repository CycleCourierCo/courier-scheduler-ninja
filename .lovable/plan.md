

# Fix: Smart Driver Grouping for Pending Allocation

## Problem
Need to group pending allocation bikes by who **physically has the bike**:

| Scenario | Physical Location | Should Group By |
|----------|------------------|-----------------|
| Freshly collected, assigned to another driver | Collection driver's van | Collection driver |
| Unloaded from delivery van | Delivery driver's van | Delivery driver |

## Solution
Use `loaded_onto_van_at` timestamp to distinguish:
- **Has timestamp** = Was previously loaded onto van = Group by delivery driver
- **No timestamp** = Never loaded = Group by collection driver

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/LoadingUnloadingPage.tsx` | Keep `loaded_onto_van_at` timestamp when unloading (don't clear it) |
| `src/components/loading/PendingStorageAllocation.tsx` | Update grouping logic to check `loaded_onto_van_at` |

## Implementation Details

### 1. LoadingUnloadingPage.tsx - Keep Timestamp on Unload

**Current code:**
```typescript
const handleUnloadFromVan = async (orderId: string) => {
  await supabase.from('orders').update({ 
    loaded_onto_van: false,
    loaded_onto_van_at: null,  // ❌ Clearing the history!
    updated_at: new Date().toISOString()
  })
```

**Fixed code:**
```typescript
const handleUnloadFromVan = async (orderId: string) => {
  await supabase.from('orders').update({ 
    loaded_onto_van: false,
    // Don't clear loaded_onto_van_at - keep it as history marker
    updated_at: new Date().toISOString()
  })
```

### 2. PendingStorageAllocation.tsx - Smart Grouping Logic

**Current code:**
```typescript
const collectedByDriver = collectedBikes.reduce((groups, bike) => {
  const driverName = getCompletedDriverName(bike, 'pickup') || 'No Driver Assigned';
  // ...
}, {});
```

**Fixed code:**
```typescript
const collectedByDriver = collectedBikes.reduce((groups, bike) => {
  // Check if bike was previously loaded onto a van (has timestamp)
  const wasLoadedOntoVan = !!bike.loaded_onto_van_at;
  
  let driverName: string;
  if (wasLoadedOntoVan && bike.delivery_driver_name) {
    // Bike was unloaded from delivery van - group by delivery driver
    driverName = bike.delivery_driver_name;
  } else {
    // Freshly collected bike - group by collection driver
    driverName = getCompletedDriverName(bike, 'pickup') || 'No Driver Assigned';
  }
  
  if (!groups[driverName]) {
    groups[driverName] = [];
  }
  groups[driverName].push(bike);
  return groups;
}, {} as Record<string, Order[]>);
```

## Logic Summary

```
If bike.loaded_onto_van_at exists:
  → Bike was on a van before → Use delivery_driver_name
Else:
  → Fresh collection → Use collection driver
```

## Data Flow Examples

**Example 1: Fresh Collection**
1. Sal collects bike, assigned to Qam for delivery
2. `loaded_onto_van_at: null` (never loaded)
3. Groups under **Sal** ✓

**Example 2: Failed Delivery Unload**
1. Bike loaded onto Qam's van at 10:00 AM
2. Delivery fails, bike unloaded
3. `loaded_onto_van_at: "2024-01-29T10:00:00"` (kept)
4. Groups under **Qam** ✓

