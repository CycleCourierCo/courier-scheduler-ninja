

## Add Admin Comments to Route Job Cards and Timeslot Edit Dialog

### Problem
Admin comments are stored in the separate `order_comments` table and are not fetched or displayed in the route builder job cards or timeslot edit dialog.

### Approach
Fetch all admin comments for orders in the route in a single batch query, store them in state, and pass them down to the job cards and timeslot dialog.

### Changes

**1. `src/components/scheduling/RouteBuilder.tsx`**
- Add state: `adminComments: Record<string, OrderComment[]>` mapping `order_id` to comments
- Add a `useEffect` that watches `selectedJobs` — whenever jobs change, fetch comments for all unique order IDs in one query:
  ```sql
  from('order_comments').select('*').in('order_id', orderIds).order('created_at', { ascending: false })
  ```
- In `JobItem`, display admin comments below the existing notes sections (both single and grouped jobs):
  ```
  💬 Admin Name: comment text (truncated)
  ```
- Pass `adminComments` to `TimeslotEditDialog` via a new prop and display them there too

**2. `src/components/scheduling/TimeslotEditDialog.tsx`**
- Add optional `adminComments` prop: `{ admin_name: string; comment: string; created_at: string }[]`
- Render them in a "Admin Notes" section below the existing notes, each with name and timestamp

### Summary
- 2 files changed
- No database changes (comments table and RLS already exist)
- Comments fetched in batch, not per-job

