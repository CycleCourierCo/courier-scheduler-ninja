

# Add "Inspect and Service" Button for Admins

## Overview

Add a button to the Order Detail page that allows admins to enable inspection for an existing order. This will:
1. Create a `bicycle_inspections` record linked to the order
2. Set `needs_inspection = true` on the order

---

## Current State

| Feature | Status |
|---------|--------|
| Inspection enabled at order creation | ✅ Works |
| Enable inspection for existing orders | ❌ Not available |
| Inspection badge on scheduling page | ✅ Works |
| Inspection badge on loading page | ✅ Works |

---

## Solution

### Files to Modify

| File | Changes |
|------|---------|
| `src/services/inspectionService.ts` | Add new `enableInspectionForOrder` function |
| `src/pages/OrderDetail.tsx` | Add "Inspect and Service" button (admin only) |

---

## Implementation Details

### 1. Add New Service Function (`src/services/inspectionService.ts`)

Create a function that enables inspection for an existing order:

```typescript
// Enable inspection for an existing order (admin action)
export const enableInspectionForOrder = async (orderId: string): Promise<BicycleInspection | null> => {
  try {
    // Update order to require inspection
    const { error: orderError } = await supabase
      .from('orders')
      .update({ needs_inspection: true })
      .eq('id', orderId);

    if (orderError) throw orderError;

    // Create or get the inspection record
    const inspection = await getOrCreateInspection(orderId);
    
    return inspection;
  } catch (error) {
    console.error('Error enabling inspection for order:', error);
    throw error;
  }
};
```

### 2. Add Button to Order Detail Page (`src/pages/OrderDetail.tsx`)

Add the button in the admin control section, near the Item Details component. The button should:
- Only show for admin users
- Only show if the order doesn't already have inspection enabled
- Call the new service function and refresh the order data

**Location in UI**: After the Item Details section, within the admin-only area.

```typescript
// Import the new function
import { enableInspectionForOrder } from "@/services/inspectionService";

// Add state for button loading
const [isEnablingInspection, setIsEnablingInspection] = useState(false);

// Add handler function
const handleEnableInspection = async () => {
  if (!id) return;
  
  try {
    setIsEnablingInspection(true);
    await enableInspectionForOrder(id);
    await handleRefreshOrder();
    toast.success("Inspection enabled for this order");
  } catch (error) {
    console.error("Error enabling inspection:", error);
    toast.error("Failed to enable inspection");
  } finally {
    setIsEnablingInspection(false);
  }
};

// Add button in JSX (admin only, when inspection not already enabled)
{isAdmin && !order.needsInspection && (
  <Button
    onClick={handleEnableInspection}
    disabled={isEnablingInspection}
    variant="outline"
    className="flex items-center gap-2"
  >
    <Wrench className="h-4 w-4" />
    {isEnablingInspection ? "Enabling..." : "Inspect and Service"}
  </Button>
)}
```

---

## UI Placement

The button will be placed in the Item Details section, shown only when:
- User is an admin
- Order doesn't already have `needsInspection = true`

```
┌─────────────────────────────────────┐
│ Item Details                    📦  │
├─────────────────────────────────────┤
│ Item: Brompton S2L                  │
│ Quantity: 1                         │
│ Order #: 12345                      │
│                                     │
│ [🔧 Inspect and Service]  ← NEW     │
└─────────────────────────────────────┘
```

After clicking, the section updates to show:
```
│ 🔧 Bike will be inspected and serviced │
```

---

## Expected Behavior

| Action | Result |
|--------|--------|
| Admin clicks "Inspect and Service" | `needs_inspection` set to `true`, `bicycle_inspections` record created with status `pending` |
| Button disappears | Once enabled, button is hidden and replaced with the existing inspection indicator |
| Scheduling page | Shows "Inspection Pending" badge (amber) |
| Loading page | Shows "Inspection Pending" badge (amber) |

---

## Summary

| Task | Description |
|------|-------------|
| New service function | `enableInspectionForOrder` - sets needs_inspection and creates inspection record |
| Add admin button | "Inspect and Service" button in Item Details section |
| Conditional display | Only show when admin AND inspection not already enabled |

