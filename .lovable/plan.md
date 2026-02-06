
# Fix Recalculate Button to Fetch Latest Coordinates

## Problem

When you click "Recalculate" on the Get Timeslot popup, the system uses the coordinates stored in local state (`selectedJobs`) rather than fetching the latest values from Supabase. If you manually update coordinates in the database, clicking Recalculate still uses the old/stale coordinates.

---

## Root Cause

| Current Flow | Issue |
|--------------|-------|
| Jobs selected → lat/lon saved to `selectedJobs` state | Coordinates captured at selection time |
| You fix coordinates in Supabase | Changes are in database only |
| Click "Recalculate" | Uses stale `selectedJobs.lat/lon` |
| Result: Wrong timeslots | Doesn't reflect your fixes |

---

## Solution

Create a new function `refreshAndCalculateTimeslots()` that:

1. Fetches the latest order data from Supabase for all selected job order IDs
2. Updates the `selectedJobs` state with fresh lat/lon coordinates
3. Proceeds with the timeslot calculation using the updated values

---

## Implementation

### File to Modify

`src/components/scheduling/RouteBuilder.tsx`

### Changes

1. **Add new function** `refreshAndCalculateTimeslots()`:

```typescript
const refreshAndCalculateTimeslots = async () => {
  if (selectedJobs.length === 0) return;

  // Get unique order IDs from selected jobs
  const orderIds = [...new Set(
    selectedJobs
      .filter(job => job.type !== 'break')
      .map(job => job.orderId)
  )];

  // Fetch latest order data from Supabase
  const { data: freshOrders, error } = await supabase
    .from('orders')
    .select('id, sender, receiver')
    .in('id', orderIds);

  if (error) {
    console.error('Error fetching latest coordinates:', error);
    toast.error('Failed to fetch latest coordinates');
    return;
  }

  // Update selectedJobs with fresh coordinates
  const updatedJobs = selectedJobs.map(job => {
    if (job.type === 'break') return job;
    
    const freshOrder = freshOrders?.find(o => o.id === job.orderId);
    if (!freshOrder) return job;

    const contact = job.type === 'pickup' 
      ? freshOrder.sender 
      : freshOrder.receiver;

    return {
      ...job,
      lat: contact?.address?.lat,
      lon: contact?.address?.lon
    };
  });

  setSelectedJobs(updatedJobs);
  
  // Now calculate with fresh data
  // (small delay to ensure state is updated)
  setTimeout(() => {
    calculateTimeslots();
  }, 100);
};
```

2. **Update "Recalculate" buttons** to call the new function:

| Location | Line | Change |
|----------|------|--------|
| Mobile drawer | ~2128 | `onClick={refreshAndCalculateTimeslots}` |
| Desktop dialog | ~2232 | `onClick={refreshAndCalculateTimeslots}` |

---

## Technical Details

### Before (Current)

```text
User clicks "Recalculate"
         ↓
calculateTimeslots() runs
         ↓
Uses job.lat/job.lon from state (STALE)
         ↓
Wrong timeslots calculated
```

### After (Fixed)

```text
User clicks "Recalculate"
         ↓
refreshAndCalculateTimeslots() runs
         ↓
Fetch fresh orders from Supabase
         ↓
Update selectedJobs with new lat/lon
         ↓
calculateTimeslots() runs
         ↓
Uses fresh coordinates
         ↓
Correct timeslots calculated
```

---

## Summary

| Task | Description |
|------|-------------|
| Add `refreshAndCalculateTimeslots` function | Fetches fresh coordinates before calculating |
| Update Recalculate button handlers | Switch from `calculateTimeslots` to `refreshAndCalculateTimeslots` |
| Add loading state (optional) | Show "Refreshing..." while fetching |

This ensures that any coordinate changes you make directly in Supabase will be picked up when you click Recalculate.
