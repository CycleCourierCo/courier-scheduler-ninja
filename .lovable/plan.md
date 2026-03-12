

## Show Notes in Timeslot Edit Dialog

### What
Display the relevant notes (sender_notes for collection jobs, receiver_notes for delivery jobs) in the TimeslotEditDialog popup so the route planner can see important context when setting timeslots.

### Change

**`src/components/scheduling/TimeslotEditDialog.tsx`**

Add a notes display section between the time input and the "Original calculated time" text:

- Extract notes from `job.orderData` or `job.order`: if `job.type === 'pickup'`, show `sender_notes`; if `delivery`, show `receiver_notes`
- Display in a styled block (muted background, small text) with a "Notes" label
- Only render the block if notes exist and are non-empty

```tsx
// After the time input, before "Original calculated time"
const notes = job.type === 'pickup' 
  ? (job.orderData?.sender_notes || job.order?.senderNotes)
  : (job.orderData?.receiver_notes || job.order?.receiverNotes);

// In JSX:
{notes && (
  <div className="space-y-1">
    <Label>{job.type === 'pickup' ? 'Collection' : 'Delivery'} Notes</Label>
    <div className="text-sm bg-muted p-2 rounded">{notes}</div>
  </div>
)}
```

Single file change, no new dependencies.

