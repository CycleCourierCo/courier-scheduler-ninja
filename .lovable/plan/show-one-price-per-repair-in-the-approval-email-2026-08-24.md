# Show one price per repair in the approval email

The customer approval email currently lists each item with three money columns: Parts, Labour and Total. Customers only need one figure.

## What changes

- Each line of work shows just its price (the existing combined total for that item).
- The Parts and Labour columns are removed from the table.
- The overall "Total if all work is approved" line stays as is.

## Technical notes

- `supabase/functions/send-inspection-approval/index.ts`: drop the `parts`/`labour` cells from the row builder and the matching `<th>` headers, leaving "Work needed" and "Price" (from `estimated_cost`). No change to the query or totals maths.
- Redeploy `send-inspection-approval`.
