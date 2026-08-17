# Add extra repairs after approval, with a payer choice

Today the "Add issue" form on an inspection only appears while the inspection is at the **Awaiting pricing** stage. Once the customer has approved the repairs and the bike moves into parts/repair/cleaning, a mechanic who finds extra work has nowhere to record it.

This adds the same ability after approval, plus a choice of who pays — reusing the billing model already used when a customer declines repairs and the receiver picks them up.

## What changes for staff

On any inspection that has moved past approval (Awaiting parts, Awaiting repair, Cleaning, Repaired), admins and mechanics get the existing **Add issue** form, with one extra step: a **Who pays?** choice.

- **Booking customer (account)** — added as an approved repair and billed the normal way with the rest of the inspection work.
- **Receiver** — added as an approved repair billed to the receiver, and a QuickBooks invoice is raised for it immediately (same behaviour as "Receiver approved" on a declined repair, including the customer-facing invoice link).

The new repair appears in the issue list straight away with an "Approved" state and, where relevant, a "Billed to receiver" badge, so it flows through the existing parts-ordered / parts-arrived / mark-repaired steps.

Guard rails:
- A price (parts and/or labour) is required when adding after approval, since there is no separate pricing round.
- Adding a repair does not push the inspection backwards — the bike stays in its current stage.
- Only admins can pick the receiver as payer; mechanics can add customer-billed work.

## Technical notes

- `src/services/inspectionService.ts`: extend `addIssueToExistingInspection` with an options argument for `status` and `billing_party` (plus `receiver_approved_at` / `receiver_approved_source: 'staff'` / `offered_to_receiver_*` when the payer is the receiver), defaulting to today's `pending` / customer behaviour so the pricing-stage flow is unchanged.
- `src/pages/BicycleInspections.tsx`:
  - Add an `isPostApproval` flag (`awaiting_parts`, `awaiting_repair`, `in_repair`, `cleaning`, `repaired`) and render the existing add-issue block for it as well as `awaiting_pricing`.
  - Add a payer select to `newIssueDraft` (`'customer' | 'receiver'`), shown only in the post-approval case.
  - In `addIssueAtPricingMutation`, when post-approval, insert with `status: 'approved'`; for the receiver payer, chain `createReceiverInspectionInvoice(issue.id)` and surface the invoice number/link toast, tolerating invoice failure the same way `receiverApproveMutation` does.
- No schema work needed: `inspection_issues.billing_party` and the receiver-approval columns already exist, and existing totals already exclude `billing_party = 'receiver'` from customer-facing sums.
