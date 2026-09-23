# Fix: receiver repair link shows "declined"

## What's happening

For CCC754135728802OLLGU4 the account holder declined all six repairs, then the work was offered to the receiver (Christopher Adderley) — that part worked. The receiver's choice actually lives on a different page than the link that was shared.

- The link used (`/inspection-approval/<inspection id>`) is the **account holder's** page. It only ever shows repairs still awaiting the account's answer, so now that everything is declined it shows "your choice has been recorded" — which reads as declined.
- The receiver's page is `/repair-offer/<order id>`. Checked against live data: it already lists all six repairs with prices, ready for the receiver to tick and approve.

Working link for this bike right now:
`https://booking.cyclecourierco.com/repair-offer/d01562c1-93f3-4832-9d0a-c5fbaedd7d14`

## Changes

1. **Send people to the right page automatically.** When the account page is opened for a bike whose repairs have moved on to the receiver, it forwards to the receiver's repair page instead of showing the "recorded" message. If there's nothing left for anyone to decide, it keeps the existing message.
2. **Staff copy-link follows the stage.** On the inspections page, the copy/open approval link gives the account link before the account answers and the receiver link once the work has been offered to the receiver, so the wrong link can't be sent again.
3. **Clearer wording when there is genuinely nothing to decide**, distinguishing "all repairs declined" from "already approved".

## About "Repairs Declined"

The bike appearing under Repairs Declined after the account declined is intended — that list is where staff pick up bikes that still have someone (the receiver) to offer the work to. Now that it has been offered, its status is "pending receiver approval" and it no longer shows there. No change needed unless you'd prefer that list renamed.

## Technical notes

- `src/pages/InspectionApproval.tsx`: when the returned status is `pending_receiver_approval`, or all issues are `declined` with `offered_to_receiver_at` set and no receiver response, redirect to `/repair-offer/<order_id>`.
- `get_public_inspection_approval` must also return `order_id` and the receiver-offer timestamps so the page can decide; small migration to extend the returned JSON (no schema change).
- `src/pages/BicycleInspections.tsx`: approval-link helper picks `/repair-offer/<order id>` when `approval_recipient` is receiver or any issue has `offered_to_receiver_at`.
- No change to `submit_public_repair_offer`, invoicing, or billing party logic.
