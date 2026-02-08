

## Fix "Collected (ready to deliver)" Filter & Sync Map with Filters

This plan addresses two issues:
1. The "Collected (ready to deliver)" toggle should filter based on the `order_collected` boolean field, not the legacy `collection_confirmation_sent_at` field
2. When filters change in the Route Builder, the ClusterMap should also update to show only the filtered jobs

---

## Current Problem

**Filter Logic Issue:**
- Current code (line 645-646 of RouteBuilder.tsx):
  ```typescript
  const isCollected = !!order.collection_confirmation_sent_at || 
    ['collected', 'driver_to_delivery', 'delivery_scheduled'].includes(order.status);
  ```
- This uses the old `collection_confirmation_sent_at` field instead of the `order_collected` boolean

**Map Not Synced:**
- `JobScheduling.tsx` passes all orders to both `ClusterMap` and `RouteBuilder`
- `RouteBuilder` applies filters internally, but `ClusterMap` doesn't know about these filters
- Result: Map shows all jobs while Route Builder shows filtered jobs

---

## Solution Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│                    JobScheduling.tsx                          │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Filter State (lifted up from RouteBuilder)             │ │
│  │  - filterDate: Date | undefined                         │ │
│  │  - showCollectedOnly: boolean                           │ │
│  └─────────────────────────────────────────────────────────┘ │
│                           │                                   │
│            ┌──────────────┼──────────────┐                   │
│            ▼              ▼              ▼                   │
│     ┌────────────┐  ┌────────────┐  ┌─────────────────┐     │
│     │ ClusterMap │  │   Filter   │  │  RouteBuilder   │     │
│     │ (filtered) │  │  Controls  │  │   (filtered)    │     │
│     └────────────┘  └────────────┘  └─────────────────┘     │
└──────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Fix the `order_collected` filter logic

**File:** `src/components/scheduling/RouteBuilder.tsx`

Change line 644-646 from:
```typescript
const isCollected = !!order.collection_confirmation_sent_at || 
  ['collected', 'driver_to_delivery', 'delivery_scheduled'].includes(order.status);
```

To:
```typescript
const isCollected = order.order_collected === true;
```

This uses the `order_collected` boolean field that is already available on `OrderData` (defined in JobScheduling.tsx line 28).

---

### Step 2: Lift filter state and controls to JobScheduling.tsx

**File:** `src/pages/JobScheduling.tsx`

Add filter state and filter UI controls:
- Add `filterDate` and `showCollectedOnly` state
- Create a reusable filter component or inline filter controls
- Pass filtered orders to both `ClusterMap` and `RouteBuilder`

**Changes:**
1. Add new state variables for filters
2. Create a filtering function that applies both date and collected filters
3. Add filter UI (date picker + toggle) above the map
4. Pass filtered orders to both components

---

### Step 3: Update RouteBuilder to accept external filter state

**File:** `src/components/scheduling/RouteBuilder.tsx`

Modify the component to:
1. Accept optional `filterDate` and `showCollectedOnly` props
2. Accept an `onFilterChange` callback to notify parent of filter changes
3. Remove internal filter state (or keep as controlled from parent)
4. Keep the filter UI in RouteBuilder but sync with parent state

**Props to add:**
```typescript
interface RouteBuilderProps {
  orders: OrderData[];
  filterDate?: Date;
  showCollectedOnly?: boolean;
  onFilterDateChange?: (date: Date | undefined) => void;
  onShowCollectedOnlyChange?: (value: boolean) => void;
}
```

---

### Step 4: Update ClusterMap to respect filters

**File:** `src/components/scheduling/ClusterMap.tsx`

The ClusterMap already filters based on order status, but it needs to also apply:
1. Date filtering (show jobs where customer dates include the filter date)
2. Collected-only filtering (for deliveries, only show if `order_collected === true`)

**Option A (simpler):** Pass pre-filtered orders from JobScheduling
**Option B (more flexible):** Pass filter props and apply in ClusterMap

I recommend **Option A** - filter in the parent and pass filtered orders to both components.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/scheduling/RouteBuilder.tsx` | Fix `isCollected` logic to use `order_collected` boolean; accept filter props from parent; call callbacks on filter change |
| `src/pages/JobScheduling.tsx` | Add filter state; create filtering function; pass filtered orders to both components; render filter controls |
| `src/components/scheduling/ClusterMap.tsx` | No changes needed if using pre-filtered orders |

---

## Technical Details

### Filtering Function (to add in JobScheduling.tsx)

```typescript
const getFilteredOrders = useMemo(() => {
  let filtered = orders || [];
  
  // Apply collected-only filter (only affects delivery visibility)
  // We filter orders that have at least one relevant job
  if (filterDate || showCollectedOnly) {
    filtered = filtered.filter(order => {
      // Check if order has valid pickup job
      const pickupDates = order.pickup_date as string[] | null;
      const hasValidPickup = !order.scheduled_pickup_date && (
        !filterDate || 
        !pickupDates || 
        pickupDates.length === 0 ||
        pickupDates.some(date => 
          format(new Date(date), 'yyyy-MM-dd') === format(filterDate, 'yyyy-MM-dd')
        )
      );
      
      // Check if order has valid delivery job
      const deliveryDates = order.delivery_date as string[] | null;
      const isCollected = order.order_collected === true;
      const hasValidDelivery = !order.scheduled_delivery_date && (
        !filterDate || 
        !deliveryDates || 
        deliveryDates.length === 0 ||
        deliveryDates.some(date => 
          format(new Date(date), 'yyyy-MM-dd') === format(filterDate, 'yyyy-MM-dd')
        )
      ) && (!showCollectedOnly || isCollected);
      
      // Keep order if it has at least one valid job
      return hasValidPickup || hasValidDelivery;
    });
  }
  
  return filtered;
}, [orders, filterDate, showCollectedOnly]);
```

---

## Expected Behavior After Fix

1. **"Collected (ready to deliver)" toggle ON:**
   - Delivery jobs only appear if `order_collected === true`
   - Collection jobs still appear (unaffected by this toggle)
   - Map updates to show only the filtered points

2. **Date filter selected:**
   - Jobs only appear if customer's availability dates include the selected date
   - Map updates to show only jobs for that date

3. **Both filters active:**
   - Combined filtering applied
   - Both Route Builder and ClusterMap show the same filtered jobs

