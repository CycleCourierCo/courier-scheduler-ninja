

# Add Unload from Van Button

## Overview
Add an "Unload from Van" button to bikes that are currently shown as loaded onto the van in the Pending Storage Allocation section. This will allow users to reverse the loading action if a bike needs to be returned to pending allocation status.

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/LoadingUnloadingPage.tsx` | Add `handleUnloadFromVan` function and pass it as prop |
| `src/components/loading/PendingStorageAllocation.tsx` | Accept new `onUnloadFromVan` prop and add Unload button |

## Implementation Details

### 1. LoadingUnloadingPage.tsx Changes

Add a new handler function to unload a bike from the van:

```typescript
const handleUnloadFromVan = async (orderId: string) => {
  try {
    const { error } = await supabase
      .from('orders')
      .update({ 
        loaded_onto_van: false,
        loaded_onto_van_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (error) {
      console.error('Error unloading bike from van:', error);
      toast.error('Failed to unload bike from van');
      return;
    }

    await fetchData();
    toast.success('Bike unloaded from van');
  } catch (error) {
    console.error('Error unloading bike from van:', error);
    toast.error('Failed to unload bike from van');
  }
};
```

Pass the handler to PendingStorageAllocation:
```tsx
<PendingStorageAllocation 
  collectedBikes={collectedBikes}
  bikesLoadedOntoVan={bikesLoadedOntoVan}
  storageAllocations={storageAllocations}
  onAllocateStorage={handleAllocateStorage}
  onUnloadFromVan={handleUnloadFromVan}  // NEW PROP
/>
```

### 2. PendingStorageAllocation.tsx Changes

**Updated Props Interface:**
```typescript
interface PendingStorageAllocationProps {
  collectedBikes: Order[];
  bikesLoadedOntoVan: Order[];
  storageAllocations: StorageAllocation[];
  onAllocateStorage: (orderId: string, allocations: { bay: string; position: number; bikeIndex: number }[]) => void;
  onUnloadFromVan: (orderId: string) => void;  // NEW PROP
}
```

**Add new icon import:**
```typescript
import { Package, MapPin, Truck, Printer, Image, PackageMinus } from "lucide-react";
```

**Add Unload Button to loaded bike cards:**
After the Print Label and See Image buttons, add a new row with the Unload button:

```tsx
<Button
  size="sm"
  variant="outline"
  onClick={() => onUnloadFromVan(bike.id)}
  className="h-9 text-xs flex-1 min-h-[44px] border-destructive text-destructive hover:bg-destructive/10"
>
  <PackageMinus className="h-3 w-3 sm:mr-1" />
  <span className="ml-1">Unload from Van</span>
</Button>
```

## UI Layout for Loaded Bikes (Updated)

```
+--------------------------------------------------+
| Bike Card (LOADED)                               |
|   Customer Name                                  |
|   Bike Brand Model                               |
|   Destination: City, PostCode                   |
|   Tracking: CC-XXXXX                             |
|   [Loaded onto Van] badge (green)                |
|                                                  |
|   [Print Label] [See Image]                      |
|   [Unload from Van]  <-- NEW BUTTON              |
+--------------------------------------------------+
```

## Button Styling
- **Unload from Van**: Destructive outline style (red border/text) to indicate this is a reversal action
- Uses `PackageMinus` icon to indicate removal from van

## Data Flow
1. User clicks "Unload from Van" button
2. `onUnloadFromVan(orderId)` is called
3. `handleUnloadFromVan` in LoadingUnloadingPage updates the order:
   - Sets `loaded_onto_van` to `false`
   - Clears `loaded_onto_van_at`
4. Data is refreshed from database
5. Bike moves from "loaded onto van" section back to "pending allocation" section

