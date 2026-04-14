

## Fix Shipday Time Offset (BST +1 Hour Issue)

### Root cause
The `pickup_timeslot` and `delivery_timeslot` are stored as UK local times (e.g., "13:00" meaning 1pm BST). These are sent directly to Shipday as-is. Shipday interprets them as UTC, then displays in UK timezone (BST = UTC+1), resulting in times appearing 1 hour later than intended during British Summer Time.

### Fix
**File: `supabase/functions/create-shipday-order/index.ts`**

Add a helper function that determines whether a given date falls within BST (last Sunday in March to last Sunday in October), and if so, subtracts 1 hour from the timeslot values before sending to Shipday. This way, when Shipday adds the BST offset for display, the times match what was scheduled on the portal.

Changes:
1. Add a `isDateInBST(date: Date)` function that checks if a date falls within BST
2. Add an `adjustTimeForShipday(timeStr: string, dateStr: string)` function that subtracts 1 hour from the time when the scheduled date is in BST
3. Apply this adjustment to `pickupWindow.start`, `pickupWindow.end`, `deliveryWindow.start`, and `deliveryWindow.end` before building the Shipday payloads

### Example
- Portal timeslot: 13:00 (BST)
- Date is in BST period, so subtract 1 hour: send 12:00 to Shipday
- Shipday interprets 12:00 UTC, displays as 13:00 BST -- correct

During GMT (winter), no adjustment is made since UK time = UTC.

### Technical detail
```
function isDateInBST(date: Date): boolean {
  // Check if date falls between last Sunday of March and last Sunday of October
  const year = date.getUTCFullYear();
  const marchLast = new Date(Date.UTC(year, 2, 31));
  const bstStart = new Date(Date.UTC(year, 2, 31 - marchLast.getUTCDay(), 1, 0, 0));
  const octLast = new Date(Date.UTC(year, 9, 31));
  const bstEnd = new Date(Date.UTC(year, 9, 31 - octLast.getUTCDay(), 1, 0, 0));
  return date >= bstStart && date < bstEnd;
}
```

One file changed, no database changes needed. Redeploy the `create-shipday-order` edge function.

