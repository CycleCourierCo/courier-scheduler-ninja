
# Add Print Label and View Image Buttons to Loading Page

## Overview
Add two action buttons to bike cards on both the **Bikes In Storage** tab and the **Pending Storage Allocation** tab:
1. **Print Label** - Generates a 4x6 shipping label PDF for the bike
2. **See Image** - Opens a popup dialog showing the collection proof-of-delivery photos

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/loading/BikesInStorage.tsx` | Add Print Label button, See Image button with popup dialog |
| `src/components/loading/PendingStorageAllocation.tsx` | Add Print Label button, See Image button with popup dialog |

## Implementation Details

### 1. BikesInStorage.tsx Changes

**New Imports:**
- Add `Printer` and `Image` icons from lucide-react
- Import `generateSingleOrderLabel` from `@/utils/labelUtils`

**New State:**
```typescript
const [imageDialogOrder, setImageDialogOrder] = useState<Order | null>(null);
```

**Helper Function to Extract Collection Images:**
```typescript
const getCollectionImages = (order: Order | undefined): string[] => {
  if (!order?.trackingEvents?.shipday?.updates) return [];
  
  const pickupId = order.trackingEvents.shipday.pickup_id?.toString();
  
  // Find collection events with POD images
  const collectionEvent = order.trackingEvents.shipday.updates.find(
    (update) => 
      (update.event === 'ORDER_COMPLETED' || update.event === 'ORDER_POD_UPLOAD') &&
      update.orderId === pickupId &&
      update.podUrls && update.podUrls.length > 0
  );
  
  return collectionEvent?.podUrls || [];
};
```

**New Button Layout (per bike card):**
```
[Edit Location] [Load onto Van]
[Print Label]   [See Image]
```

**Image Dialog:**
- Modal popup showing collection photos
- Gallery view with large images
- "No collection images available" message if none exist

### 2. PendingStorageAllocation.tsx Changes

**New Imports:**
- Add `Printer` and `Image` icons from lucide-react
- Import Dialog components
- Import `generateSingleOrderLabel` from `@/utils/labelUtils`

**New State:**
```typescript
const [imageDialogOrder, setImageDialogOrder] = useState<Order | null>(null);
```

**Same Helper Function** for extracting collection images

**New Button Layout (per bike card):**
- Add a row with Print Label and See Image buttons above the allocation inputs
- Uses same styling for consistency

**Image Dialog:**
- Same modal popup implementation as BikesInStorage

## UI Design

### Button Styling
- **Print Label**: Blue outline button with Printer icon
- **See Image**: Standard outline button with Image icon, disabled if no images available

### Image Dialog
- Title: "Collection Photos - [Customer Name]"
- Gallery grid showing all POD images from collection
- Images displayed at max-width with responsive sizing
- Empty state: "No collection images available yet"

## Data Flow

The collection images are stored in the order's tracking events:
```
order.trackingEvents.shipday.updates[] 
  -> find event where event === 'ORDER_COMPLETED' or 'ORDER_POD_UPLOAD'
  -> podUrls array contains image URLs
```

The `pickup_id` in tracking events identifies collection-related updates (vs delivery updates).

## Technical Notes

- The `generateSingleOrderLabel` function from `labelUtils.ts` already handles multi-bike orders and generates proper 4x6 label PDFs
- Collection images come from the Shipday integration when drivers complete pickups with photo proof
- Both components receive the full `Order` object which includes `trackingEvents`
