## Problem

The Bulk Message button was added to `MultiJobTimeslotDialog`, but the screenshots show the "Route Timeslots" drawer inside `RouteBuilder.tsx` (with Recalculate + Flip Route buttons and Send All / Send All (SendZen) at the bottom). That's a different component, so the button never appears where expected.

## Fix

Add a **Bulk Message** button in `src/components/scheduling/RouteBuilder.tsx` right next to the **Flip Route** button, in both places it renders:
- Mobile drawer block (around line 3524)
- Desktop block (around line 3713)

Wire it to the existing `BulkRouteMessageDialog`, passing the current route's jobs (mapped into the shape the dialog expects: orderId, type, contactName, phoneNumber, address, order snapshot, plus the completion flags order_delivered / order_collected / box status so completed jobs render unticked).

Add local state `bulkMessageOpen` and render `<BulkRouteMessageDialog>` once inside the component. Button is disabled when there are no jobs in the builder.

Leave the copy in `MultiJobTimeslotDialog` in place (harmless) or remove it — I'll remove it to avoid duplication.

## Technical details

- File: `src/components/scheduling/RouteBuilder.tsx`
  - Import `BulkRouteMessageDialog` and `MessageSquare` icon.
  - Add `const [bulkMessageOpen, setBulkMessageOpen] = useState(false);`
  - After each Flip Route button, add a matching `<Button variant="outline" onClick={() => setBulkMessageOpen(true)}>` with `<MessageSquare />` + "Bulk Message".
  - Render `<BulkRouteMessageDialog open={bulkMessageOpen} onOpenChange={setBulkMessageOpen} jobs={jobsForBulk} />` once at the end of the component's return.
  - Build `jobsForBulk` from the current route stops list already used to render the drawer rows.
- File: `src/components/scheduling/MultiJobTimeslotDialog.tsx`
  - Remove the Bulk Message button + `BulkRouteMessageDialog` usage added earlier.
