

## Show Notes in Route Timeslots Job Cards

### Problem
Notes were added to the `TimeslotEditDialog` (the popup after clicking "Send"), but they need to be visible directly in the **JobItem** cards within the Route Timeslots dialog so you can see them at a glance while planning.

### Changes

**`src/components/scheduling/RouteBuilder.tsx`** — Add notes display to JobItem component:

1. **Single job cards** (after the badges row, ~line 417): Add a compact notes section showing:
   - Delivery Instructions (if present, for any job type)
   - Sender Notes (for pickup jobs)
   - Receiver Notes (for delivery jobs)

2. **Grouped job cards** (inside each grouped job, ~line 350): Same notes display per sub-job.

The notes will render as small muted text blocks below the badges, like:
```tsx
{job.type !== 'break' && (
  <>
    {job.orderData?.delivery_instructions && (
      <p className="text-xs text-muted-foreground mt-1">📋 {job.orderData.delivery_instructions}</p>
    )}
    {job.type === 'pickup' && job.orderData?.sender_notes && (
      <p className="text-xs text-muted-foreground">📝 {job.orderData.sender_notes}</p>
    )}
    {job.type === 'delivery' && job.orderData?.receiver_notes && (
      <p className="text-xs text-muted-foreground">📝 {job.orderData.receiver_notes}</p>
    )}
  </>
)}
```

### Summary
- 1 file changed (`RouteBuilder.tsx`)
- Notes shown inline in both single and grouped job cards
- Compact styling to avoid cluttering the route view

