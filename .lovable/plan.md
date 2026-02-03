

# Fix: Add Inspection Badge to Available Jobs Cards

## Problem

The inspection status badge is **only** shown on jobs in the Route Timeslots dialog (after clicking "Get Timeslots"), but is **missing** from the Available Jobs cards in the main scheduling grid.

**Current badge locations:**
| Location | Collection Status Badge | Inspection Badge |
|----------|------------------------|------------------|
| Available Jobs cards | ✅ Shows | ❌ Missing |
| Selected Jobs (Route Timeslots) | ✅ Shows | ✅ Shows |

The screenshot confirms this - the delivery job card shows "Delivery" and "Awaiting Collection" badges, but no inspection badge.

---

## Root Cause

The inspection badge was added to the `JobItem` component (lines 382-391) used in the route dialog, but was never added to the available jobs cards rendered in lines 1916-1975.

---

## Solution

Add the inspection badge to the available jobs cards in the same location as the collection status badge.

### File to Modify

| File | Changes |
|------|---------|
| `src/components/scheduling/RouteBuilder.tsx` | Add inspection badge to available jobs cards (after collection status badge) |

---

## Implementation Details

### Location in Code

Add after line 1933 (after the collection status badge section):

```typescript
{/* Inspection Status Badge */}
{job.order.needs_inspection && (() => {
  const isInspectionComplete = job.order.inspection_status === 'inspected' || job.order.inspection_status === 'repaired';
  return (
    <Badge className={`text-xs flex items-center gap-1 ${
      isInspectionComplete 
        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
        : 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
    }`}>
      <Wrench className="h-3 w-3" />
      {isInspectionComplete ? 'Inspection Done' : 'Inspection Pending'}
    </Badge>
  );
})()}
```

---

## Expected Result

After implementation, the delivery job card for order `#CCC754938090143BROB10` will show:

| Badge | Color | Status |
|-------|-------|--------|
| Delivery | Default | Job type |
| Awaiting Collection | Amber | Collection not confirmed |
| **Inspection Done** | **Green** | **Inspection status is "repaired"** |

---

## Summary

| Task | Description |
|------|-------------|
| Add inspection badge | Show "Inspection Done" (green) or "Inspection Pending" (amber) on available job cards |
| Location | After the collection status badge in the available jobs grid |
| Condition | Only show if `needs_inspection` is true |

