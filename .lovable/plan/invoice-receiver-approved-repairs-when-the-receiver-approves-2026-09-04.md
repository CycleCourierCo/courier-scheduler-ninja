# Invoice receiver-approved repairs when the receiver approves themselves

## What I found for CCC754662412561STEBH2

Two repairs were approved by the receiver on 2 Sep 05:32 via the public repair-offer page (`receiver_approved_source = 'receiver'`, £35 each, billed to receiver, now marked repaired). **No invoice was created and nothing was emailed to the receiver** — all invoice fields on both issues are empty.

Cause: invoicing only runs from the staff-side button in `BicycleInspections.tsx`, which calls `createReceiverInspectionInvoice`. The public path goes through the `submit_public_repair_offer` database function, which only flips statuses and never triggers the invoice function. The inspection's own invoice (#3351) covers the customer-billed £45 repair only.

## What changes

1. **Public approval raises the invoice automatically.** When the receiver approves repairs on the offer page, the receiver-billed repairs are invoiced immediately (one invoice covering all repairs they approved for that order) and the receiver gets the invoice email with the public pay link and PDF, exactly as the staff button does today.
2. **Backfill this order.** Raise the missing receiver invoice for the two approved repairs on CCC754662412561STEBH2 and send it to the receiver.
3. **Safety net:** if invoice creation fails (QuickBooks down, no receiver email), the approval still stands, the failure is logged, and the repairs stay visible to staff as "approved, not invoiced" so an admin can raise it from the inspection card.

## Technical notes

- New edge function step: `submitPublicRepairOffer` (`src/services/inspectionService.ts`) calls a new edge function `finalise-public-repair-offer` (public, no JWT — validated by order id like the other public repair-offer RPCs) which:
  - re-reads the approved receiver-billed issues for that order that have no `invoice_number`,
  - invokes the existing receiver-invoice logic per issue (or batched), reusing `create-receiver-inspection-invoice`'s QuickBooks + Resend path via a shared helper,
  - runs in `EdgeRuntime.waitUntil` after returning success so the receiver's page confirms instantly.
- Keep the existing idempotency in `create-receiver-inspection-invoice` (returns the existing invoice when `invoice_number` is set) so retries can't duplicate.
- No schema change: `inspection_issues` already has `invoice_number`, `invoice_id`, `invoice_url`, `invoice_public_url`, `invoiced_at`, `invoiced_by_*`.
- Backfill is done by invoking `create-receiver-inspection-invoice` for the two issues (`a6c5deec…`, `86a8ca8d…`) once the flow is in place.
