# Reverse a declined repair back to approved

Staff can change their mind on a declined inspection issue and put it back into the normal (customer-paid) repair flow, without having to use the receiver-offer route.

## What staff see

On any declined issue in Bicycle Inspections, alongside the existing "Receiver approved — do this repair" button, a new action:

- **"Customer approved — undo decline"** — flips the issue back to approved, billed to the booking customer as usual.
- Confirmation toast: "Issue moved back to approved".
- The declined badge disappears and the issue rejoins the workshop queue (parts ordering, mark repaired, invoicing) exactly like any other approved issue.
- If the issue was previously receiver-approved and then undone, this action still works — it always resets billing to `customer`.

Visible to admins and mechanics (same permission as the existing per-issue actions).

## Behaviour rules

- Clears receiver-offer traces so the repair isn't treated as receiver-billed: `billing_party` back to `customer`, `receiver_approved_at`, `receiver_approved_source`, `receiver_declined_at` cleared.
- Records the change as a customer response ("Approved (decline reversed by <staff name>)") with a fresh response timestamp.
- Because outstanding work re-opens, the existing auto-settle-to-Invoiced rule and delivery-date gating recalculate on refresh — an inspection that had auto-settled because everything was declined will move back out of the Invoiced tab.
- The receiver offer card and counts recompute from live issue statuses, so an un-declined issue drops out of the "declined" set automatically.

## Technical notes

- `src/services/inspectionService.ts`: new `reinstateDeclinedIssue(issueId, userId, userName)` that updates the row to `status: 'approved'`, `billing_party: 'customer'`, nulls the receiver fields, sets `customer_response`/`customer_responded_at`, and calls the existing `pushIssueStatusToInspectaBike` push like `acceptIssue` does.
- `src/pages/BicycleInspections.tsx`: add a `reinstateIssueMutation` (invalidates `["bicycle-inspections"]`) and render the new button inside the existing `issue.status === "declined"` block next to the receiver-approved action.
- No database migration needed — all columns already exist.
