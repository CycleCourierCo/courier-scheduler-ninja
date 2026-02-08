

## Fix Map Filtering - Hide Completed Collection Jobs

A simple update to hide collection markers from the map when the order has already been collected.

---

## Single Rule to Implement

| Job Type | Rule |
|----------|------|
| Collection | Hide if `order_collected === true` (already collected) |
| Delivery | No change - show based on existing status logic |

---

## Changes Required

### File: `src/components/scheduling/ClusterMap.tsx`

**Update `getJobsForOrder` function (lines 27-38):**

Current code:
```typescript
const getJobsForOrder = (order: OrderData): ('collection' | 'delivery')[] => {
  const status = order.status;
  
  if (['delivered', 'cancelled'].includes(status)) return [];
  if (['collected', 'driver_to_delivery', 'delivery_scheduled'].includes(status)) {
    return ['delivery'];
  }
  if (status === 'collection_scheduled') {
    return ['collection'];
  }
  return ['collection', 'delivery'];
};
```

New code:
```typescript
const getJobsForOrder = (order: OrderData): ('collection' | 'delivery')[] => {
  const status = order.status;
  const isCollected = order.order_collected === true;
  
  if (['delivered', 'cancelled'].includes(status)) return [];
  if (['collected', 'driver_to_delivery', 'delivery_scheduled'].includes(status)) {
    return ['delivery'];
  }
  if (status === 'collection_scheduled') {
    // Hide collection marker if already collected
    return isCollected ? [] : ['collection'];
  }
  
  // For other statuses, hide collection if already collected
  const jobs: ('collection' | 'delivery')[] = [];
  if (!isCollected) {
    jobs.push('collection');
  }
  jobs.push('delivery');
  return jobs;
};
```

---

## Expected Behavior

| `order_collected` | Collection Marker | Delivery Marker |
|-------------------|-------------------|-----------------|
| `false` | Shown | Shown (based on status) |
| `true` | Hidden (already done) | Shown (based on status) |

**Result:** Collection markers automatically disappear from the map once an order is marked as collected, keeping the map clean and focused on pending work.

