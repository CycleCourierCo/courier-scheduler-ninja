

# Add Inspection Status Badge to Loading/Storage Page

## Overview

Add an "Inspection Pending" or "Inspection Done" badge to bike cards on the Loading/Storage page for bicycles that have been collected and require inspection. This mirrors the badge already implemented on the Job Scheduling page.

---

## Current State

| Component | Shows Inspection Badge |
|-----------|----------------------|
| Job Scheduling page | ✅ Yes (after recent fix) |
| Loading page - Bikes In Storage | ❌ No |
| Loading page - Pending Storage Allocation | ❌ No |

---

## Solution Approach

1. **Add inspection_status to Order type** - Enable tracking actual inspection status
2. **Update getOrdersForLoading** - Join `bicycle_inspections` table to fetch status
3. **Add badges to both components** - Show status on bike cards

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/types/order.ts` | Add `inspection_status` field to Order type |
| `src/services/orderService.ts` | Update `getOrdersForLoading` to join bicycle_inspections |
| `src/components/loading/BikesInStorage.tsx` | Add inspection badge to storage cards |
| `src/components/loading/PendingStorageAllocation.tsx` | Add inspection badge to pending allocation cards |

---

## Implementation Details

### 1. Update Order Type (`src/types/order.ts`)

Add new field to track inspection status:

```typescript
export type Order = {
  // ... existing fields ...
  inspection_status?: 'pending' | 'inspected' | 'issues_found' | 'in_repair' | 'repaired' | null;
};
```

### 2. Update Data Fetching (`src/services/orderService.ts`)

Modify the query to join inspection data:

```typescript
export const getOrdersForLoading = async (): Promise<Order[]> => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*, bicycle_inspections(status)")  // JOIN inspection table
      .not('status', 'eq', 'cancelled')
      .not('status', 'eq', 'delivered')
      .order("created_at", { ascending: false })
      .limit(5000);

    // Map the inspection status from joined data
    return data.map(order => ({
      ...mapDbOrderToOrderType(order),
      inspection_status: order.bicycle_inspections?.[0]?.status || null
    }));
  } catch (error) {
    // ... error handling
  }
};
```

### 3. Add Badge to Bikes In Storage (`src/components/loading/BikesInStorage.tsx`)

Add inspection badge in the badges section (after status badge):

```typescript
{/* Inspection Status Badge */}
{order?.needsInspection && (() => {
  const isComplete = order.inspection_status === 'inspected' || order.inspection_status === 'repaired';
  return (
    <Badge className={`text-xs flex items-center gap-1 ${
      isComplete 
        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
        : 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
    }`}>
      <Wrench className="h-3 w-3" />
      {isComplete ? 'Inspection Done' : 'Inspection Pending'}
    </Badge>
  );
})()}
```

### 4. Add Badge to Pending Storage Allocation (`src/components/loading/PendingStorageAllocation.tsx`)

Add the same badge to both:
- **Bikes loaded onto van** section
- **Bikes pending storage allocation** section

---

## Badge States

| Inspection Status | Badge | Color |
|------------------|-------|-------|
| `inspected` | Inspection Done | Green |
| `repaired` | Inspection Done | Green |
| `pending` | Inspection Pending | Amber |
| `issues_found` | Inspection Pending | Amber |
| `in_repair` | Inspection Pending | Amber |
| No record | Inspection Pending | Amber |

---

## Visual Result

After implementation, bike cards will show:

**Bikes In Storage tab:**
```
[Bay Position] Customer Name
[Days in Storage] [Status] [Collected by Driver] [Inspection Done ✓] or [Inspection Pending ⚠]
```

**Pending Storage Allocation tab:**
```
Customer Name
Bike details...
[X bikes total] [X remaining] [In Driver Van] [Inspection Pending ⚠]
```

---

## Summary

| Task | Description |
|------|-------------|
| Add `inspection_status` to Order | New optional field for inspection status |
| Update `getOrdersForLoading` | Join bicycle_inspections table |
| Add badge to BikesInStorage | Show inspection status on stored bikes |
| Add badge to PendingStorageAllocation | Show inspection status on collected bikes awaiting allocation |

