# Offer declined repairs to the receiver

When the booking customer declines some (or all) recommended repairs, staff can offer those same repairs to the person receiving the bike. The receiver gets an email and a WhatsApp with a link showing what was approved, what was declined, and the price to have the declined work done. Admin can also record a receiver approval manually.

## What staff see

On the inspection card in Bicycle Inspections, once at least one issue is declined:

- A button **"Offer declined repairs to receiver"**. It opens a short confirm dialog listing:
  - "The customer has approved the following repairs" (approved/resolved issues)
  - "…but has not approved the following" (declined issues, each with its price)
  - Total cost of the declined work, plus the receiver's email and mobile it will go to.
- After sending, the card shows "Offered to receiver on <date>" and the button becomes "Re-send offer".
- On each declined issue, a per-issue admin action **"Receiver approved"** (with an "Undo" if pressed by mistake). This moves the issue into the normal approved/repair flow, and badges it **"Receiver approved — receiver pays"** everywhere the issue appears.

## What the receiver sees

A public page (no login) reached from the email/WhatsApp link, listing:

- Repairs already approved and being done (read-only, no prices attributed to them).
- Repairs the customer declined, each with description and price, with a tick per repair and a running total.
- A "Confirm these repairs" button and a "No thanks" button. On submit the page confirms and the ticked repairs immediately show as receiver-approved in the workshop.
- Explains clearly that any repairs they approve are paid by them directly, not by the seller, and that we will be in touch about payment.

## Billing

Receiver-approved repairs are marked as **payer: receiver** and are excluded from the booking customer's inspection invoice, so the seller is never charged for them. They still count as completed workshop labour for scheduling and mechanic productivity. Collecting payment from the receiver stays a manual step (no new payment flow in this change).

## Behaviour rules

- Only declined issues can be offered; approved and already-resolved issues are never re-offered.
- A receiver approval flips the issue to the same `approved` status the workshop already understands, so parts ordering, repair completion and the cleaning/repaired stages behave identically.
- Repairs the receiver also declines are recorded as receiver-declined and stay out of the workshop queue.
- Delivery date scheduling gating is unchanged in logic, but a receiver approval re-opens outstanding work, so the delivery-date prompt correctly waits until those repairs are finished.
- No offer is sent for test-account orders (existing test-account suppression applies).

## Technical notes

Database (migration):
- `inspection_issues`: add `offered_to_receiver_at`, `offered_to_receiver_by_id/name`, `receiver_approved_at`, `receiver_approved_source` (`receiver` | `admin`), `receiver_declined_at`, `billing_party` (`customer` | `receiver`, default `customer`).
- Two `security definer` RPCs following the existing public-order pattern (order UUID as the secret in the URL):
  - `get_public_repair_offer(p_order_id uuid)` → approved list, declined/offered list with costs, order + bike summary, whether already responded.
  - `submit_public_repair_offer(p_order_id uuid, p_approved_issue_ids uuid[])` → sets `status='approved'`, `billing_party='receiver'`, `receiver_approved_at`, source `receiver`; marks the rest receiver-declined. Rejects issues not in the offered set.
- Grants: `execute` to `anon`/`authenticated` on the RPCs only; no new table grants for `anon`.

Frontend:
- New public page `src/pages/RepairOffer.tsx` at route `/repair-offer/:id` (unauthenticated, like `/receiver-availability/:id`).
- `src/services/inspectionService.ts`: `offerDeclinedRepairsToReceiver(orderId)`, `markIssueReceiverApproved(issueId, admin)`, `undoReceiverApproval(issueId)`, plus fetch/submit helpers for the public page.
- `src/pages/BicycleInspections.tsx`: offer button + dialog, offered-at indicator, per-issue "Receiver approved" action and badge.
- Invoicing: `create-inspection-invoice` / `create-inspection-service-invoice` skip issues with `billing_party = 'receiver'`; the inspections "Invoiced" auto-settle rules treat receiver-paid issues as non-billable so a fully receiver-paid inspection doesn't sit in the invoice queue.

Edge function `send-repair-offer`:
- Builds the offer email (Resend, `CCC - Cycle Courier Co.` sender, reply-to Info@cyclecourierco.com) and a SendZen WhatsApp message to the receiver's mobile, both linking to `/repair-offer/<order id>`.
- Verifies the caller's JWT and admin/mechanic role, records `offered_to_receiver_at` on the declined issues, and never logs receiver contact details.
