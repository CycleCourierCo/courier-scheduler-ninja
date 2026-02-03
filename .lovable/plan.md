

# Show Inspection Status on Order Page & Fix Bicycle Inspections Display

## Overview

This plan addresses two issues:
1. **Display inspection status** on the order page's Item Details section to show when a bike will be inspected and serviced
2. **Fix the Bicycle Inspections page** so it shows all bikes requiring inspection, not just those with specific statuses

---

## Issue 1: Why Bikes Don't Appear on Bicycle Inspections Page

**Root Cause:** The `getPendingInspections()` function in `inspectionService.ts` filters orders by status:

```typescript
.in('status', ['collected', 'driver_to_delivery', 'delivery_scheduled', 'scheduled'])
```

Order `CCC754938090143BROB10` has `status = 'created'`, which is **not in the filter list**, so it doesn't appear.

**Solution:** Include all relevant statuses including early stages like `created`, `sender_availability_pending`, etc. Alternatively, show all orders with `needs_inspection = true` regardless of status so admins have full visibility.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/order-detail/ItemDetails.tsx` | Add inspection status display with icon |
| `src/services/inspectionService.ts` | Update status filter to include more order statuses |
| `src/pages/CustomerOrderDetail.tsx` | Add inspection status display in item details section |

---

## Implementation Details

### 1. Update ItemDetails Component (`src/components/order-detail/ItemDetails.tsx`)

Add a visual indicator when the order requires inspection and servicing:

```typescript
import { Package, FileText, Wrench } from "lucide-react";

// Inside the component, add after payment collection display:
{order.needsInspection && (
  <div className="flex items-center gap-2 text-amber-600 font-medium mt-2">
    <Wrench className="h-4 w-4" />
    Bike will be inspected and serviced
  </div>
)}
```

This will display an amber wrench icon with text "Bike will be inspected and serviced" in the Item Details section when the order has `needsInspection = true`.

### 2. Fix Inspection Service Status Filter (`src/services/inspectionService.ts`)

Update the `getPendingInspections()` function to include all order statuses so admins can see bikes requiring inspection at any stage:

**Current code (line 57):**
```typescript
.in('status', ['collected', 'driver_to_delivery', 'delivery_scheduled', 'scheduled'])
```

**Updated code:**
```typescript
.in('status', [
  'created',
  'sender_availability_pending',
  'sender_availability_confirmed', 
  'receiver_availability_pending',
  'receiver_availability_confirmed',
  'scheduled_dates_pending',
  'pending_approval',
  'scheduled',
  'collection_scheduled',
  'driver_to_collection',
  'collected',
  'driver_to_delivery',
  'delivery_scheduled'
])
```

This ensures orders like `CCC754938090143BROB10` (status = 'created') will now appear on the Bicycle Inspections page.

### 3. Update CustomerOrderDetail Page (`src/pages/CustomerOrderDetail.tsx`)

Add inspection status display in the item details section (around line 196-211) to match the admin view:

```typescript
{order.needsInspection && (
  <p className="text-amber-600 font-medium mt-2 flex items-center gap-2">
    <Wrench className="h-4 w-4" />
    Bike will be inspected and serviced
  </p>
)}
```

---

## Visual Result

### Order Detail Page - Item Details Section

Before:
```text
┌─────────────────────────────────────────┐
│ 📦 Item Details                         │
├─────────────────────────────────────────┤
│ Item: Trek Domane SL7                   │
│ Quantity: 1                             │
│ Order #: 12345                          │
│ This is a bike swap                     │
└─────────────────────────────────────────┘
```

After:
```text
┌─────────────────────────────────────────┐
│ 📦 Item Details                         │
├─────────────────────────────────────────┤
│ Item: Trek Domane SL7                   │
│ Quantity: 1                             │
│ Order #: 12345                          │
│ This is a bike swap                     │
│ 🔧 Bike will be inspected and serviced  │  ← New line (amber)
└─────────────────────────────────────────┘
```

### Bicycle Inspections Page

Will now show order `CCC754938090143BROB10` (and all other orders with `needs_inspection = true`) regardless of their current status, giving admins complete visibility over all bikes that will require inspection.

---

## Summary

| Task | Description |
|------|-------------|
| ItemDetails update | Add wrench icon + "Bike will be inspected and serviced" text |
| CustomerOrderDetail update | Add same inspection display for customer view |
| Inspection service fix | Expand status filter to include all order statuses |

