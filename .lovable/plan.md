

# Add Order Status Badge and Storage Location to Bicycle Inspections Page

## Overview

Add order status badge and storage bay allocation information to the inspection cards on the Bicycle Inspections page. This will help admins quickly see whether a bike has been collected and where it's located in storage.

---

## Current State

| Information | Currently Shown |
|-------------|----------------|
| Bike brand/model | ✅ Yes |
| Inspection status badge | ✅ Yes |
| Order status (collected, scheduled, etc.) | ❌ No |
| Storage bay allocation | ❌ No |

---

## Solution

### Files to Modify

| File | Changes |
|------|---------|
| `src/services/inspectionService.ts` | Add `storage_locations` to the query select fields |
| `src/pages/BicycleInspections.tsx` | Add order status badge and storage location badges to cards |

---

## Implementation Details

### 1. Update Query to Include Storage Locations (`src/services/inspectionService.ts`)

Add `storage_locations` to both `getPendingInspections` and `getMyInspections` queries:

```typescript
const { data, error } = await supabase
  .from('orders')
  .select(`
    id,
    tracking_number,
    bike_brand,
    bike_model,
    bike_quantity,
    status,
    sender,
    receiver,
    user_id,
    needs_inspection,
    storage_locations   // ADD THIS
  `)
```

### 2. Add Badges to Inspection Cards (`src/pages/BicycleInspections.tsx`)

#### Import StatusBadge Component

```typescript
import StatusBadge from "@/components/StatusBadge";
import { MapPin } from "lucide-react";
```

#### Update the renderInspectionCard Function

Add badges section after the card description showing:
- **Order Status Badge**: Using the existing `StatusBadge` component
- **Storage Location Badges**: Show bay positions if allocated (e.g., "A12", "B5")

```typescript
<CardDescription>
  #{order.tracking_number} • {(order.sender as any)?.name} → {(order.receiver as any)?.name}
</CardDescription>
{/* NEW: Order status and storage location badges */}
<div className="flex flex-wrap gap-2 mt-2">
  <StatusBadge status={order.status} />
  {order.storage_locations && Array.isArray(order.storage_locations) && 
   order.storage_locations.length > 0 && (
    <>
      {order.storage_locations.map((location: any, idx: number) => (
        <Badge key={idx} variant="outline" className="flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {location.bay}{location.position}
        </Badge>
      ))}
    </>
  )}
</div>
```

---

## Visual Result

After implementation, inspection cards will show:

```
┌────────────────────────────────────────────────────────┐
│ 🔧 Brompton S2L                           [No Issues]  │
│ #CC-240001 • John Smith → Jane Doe                     │
│                                                        │
│ [Bike Collected] [📍 A12] [📍 A13]  ← NEW BADGES       │
│                                                        │
│ Inspected by Admin on 15/01/2026                       │
└────────────────────────────────────────────────────────┘
```

For multi-bike orders, all storage locations will be shown:
```
│ [Driver En Route to Delivery] [📍 A12] [📍 A13] [📍 B5] │
```

---

## Technical Notes

### Status Badge Colors (from existing StatusBadge component)

| Order Status | Badge Color |
|--------------|-------------|
| collected | Green |
| driver_to_delivery | Blue |
| scheduled | Purple |
| delivery_scheduled | Blue |
| created | Gray |

### Storage Location Badge

- Uses `outline` variant with a `MapPin` icon
- Format: Bay letter + Position number (e.g., "A12", "B5", "C20")
- Only shown when `storage_locations` array exists and has entries

---

## Summary

| Task | Description |
|------|-------------|
| Update queries | Add `storage_locations` field to inspection queries |
| Import StatusBadge | Reuse existing component for consistency |
| Add order status badge | Show current order status (collected, scheduled, etc.) |
| Add storage location badges | Show bay positions with MapPin icon |

