

# Fix Inspection Status Display on Scheduling Page

## Problem Analysis

Order `#CCC754938090143BROB10` has inspection status `repaired` in the database, but the scheduling page shows "Needs Inspection" because:

1. **Missing data**: The `OrderData` interface only has `needs_inspection: boolean` - no field for the actual inspection status
2. **Missing join**: The scheduling query only fetches from `orders` table without joining `bicycle_inspections`
3. **Incomplete logic**: The `getInspectionStatusBadge` function only checks if inspection is needed, not whether it's complete

---

## Solution

### Data Flow

```text
Current:
─────────────────────────────────────────
orders table ──> OrderData (needs_inspection: boolean)
                     ↓
              getInspectionStatusBadge()
                     ↓
              Always shows "Needs Inspection"

Fixed:
─────────────────────────────────────────
orders table + bicycle_inspections ──> OrderData (needs_inspection + inspection_status)
                     ↓
              getInspectionStatusBadge()
                     ↓
              Shows correct status:
              • "Inspection Done" (green) - inspected or repaired
              • "Inspection Pending" (amber) - pending/issues_found/in_repair
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/JobScheduling.tsx` | Add `inspection_status` to OrderData, join bicycle_inspections in query |
| `src/components/scheduling/RouteBuilder.tsx` | Update `getInspectionStatusBadge` to show correct status based on inspection_status |

---

## Implementation Details

### 1. Update OrderData Interface (`JobScheduling.tsx`)

Add new field to track actual inspection status:

```typescript
export interface OrderData {
  // ... existing fields ...
  needs_inspection: boolean | null;
  inspection_status: 'pending' | 'inspected' | 'issues_found' | 'in_repair' | 'repaired' | null;  // NEW
}
```

### 2. Update Query to Join Inspection Data (`JobScheduling.tsx`)

Modify the query to fetch inspection status:

```typescript
const { data, error } = await supabase
  .from('orders')
  .select('*, bicycle_inspections(status)')  // JOIN inspection table
  .not('status', 'in', '(cancelled,delivered)')
  .order('created_at', { ascending: false });

// Map the inspection status from joined data
return data.map(order => ({
  ...order,
  sender: order.sender as ContactInfo & { address: Address },
  receiver: order.receiver as ContactInfo & { address: Address },
  status: order.status as OrderStatus,
  inspection_status: order.bicycle_inspections?.[0]?.status || null  // Extract status
})) as OrderData[];
```

### 3. Update Badge Logic (`RouteBuilder.tsx`)

Modify `getInspectionStatusBadge` to show correct status:

```typescript
const getInspectionStatusBadge = (
  needsInspection: boolean | null | undefined,
  inspectionStatus: string | null | undefined
): { text: string; color: string; icon: JSX.Element } | null => {
  // If inspection is not required, don't show any badge
  if (!needsInspection) return null;
  
  // Check if inspection is complete (inspected with no issues OR repaired)
  if (inspectionStatus === 'inspected' || inspectionStatus === 'repaired') {
    return {
      text: 'Inspection Done',
      color: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
      icon: <Wrench className="h-3 w-3" />
    };
  }
  
  // Show pending badge for all other cases
  return {
    text: 'Inspection Pending',
    color: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300',
    icon: <Wrench className="h-3 w-3" />
  };
};
```

### 4. Update Badge Calls in JobItem Component

Update all calls to `getInspectionStatusBadge` to pass the new parameter:

```typescript
// In grouped jobs
const inspectionBadge = getInspectionStatusBadge(
  groupedJob.orderData?.needs_inspection,
  groupedJob.orderData?.inspection_status  // NEW parameter
);

// In single jobs  
const inspectionBadge = getInspectionStatusBadge(
  job.orderData?.needs_inspection,
  job.orderData?.inspection_status  // NEW parameter
);
```

---

## Badge States Summary

| Inspection Status | Badge Shown | Color |
|------------------|-------------|-------|
| `inspected` (no issues) | Inspection Done | Green |
| `repaired` | Inspection Done | Green |
| `pending` | Inspection Pending | Amber |
| `issues_found` | Inspection Pending | Amber |
| `in_repair` | Inspection Pending | Amber |
| No inspection record | Inspection Pending | Amber |

---

## Expected Result

After implementation, order `#CCC754938090143BROB10` will show:
- **Inspection Done** (green badge) because its inspection status is `repaired`

