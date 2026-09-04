# One receiver invoice per bike, not per repair

Right now each receiver-approved repair gets its own QuickBooks invoice — that is why CCC754662412561STEBH2 produced #3352 and #3353 for the same bike. This changes the flow so a bike gets a single invoice with one line per repair.

## What changes

- When a receiver approves repairs (public offer page or staff "Receiver approved" button), one invoice is raised for that bike covering every receiver-billed repair that isn't already invoiced, with each repair as its own line item.
- All included repairs share the same invoice number, link and PDF, so the badge on each issue card points at the one invoice.
- One email to the receiver listing every repair and the combined total.
- If an invoice already exists for that bike and a further repair is later approved by the receiver, a second invoice is raised for just the new repair(s) — existing invoices are never edited.

## Cleaning up this order

Invoices #3352 and #3353 (£35 each, receiver antcov.ab@gmail.com) are duplicates of what should have been one invoice. Plan: void both in QuickBooks, clear the invoice fields on the two issues, then re-run the new combined flow so the receiver gets a single £70 invoice and one email. If you would rather leave the two live invoices as they are, say so and this step is skipped.

## Technical notes

- `supabase/functions/create-receiver-inspection-invoice/index.ts`:
  - Accept `{ inspectionId }` or `{ issueId }` (kept for compatibility) and resolve the full set of eligible issues: same inspection, `billing_party = 'receiver'`, `receiver_approved_at` set, `estimated_cost > 0`, `invoice_number` null.
  - Build one `Line[]` array — one line per issue, `Amount = estimated_cost / 1.2`, description `"<tracking> - <brand> <model> - <issue_description>"`.
  - Post a single invoice, then stamp `invoice_number/invoice_id/invoice_url/invoice_public_url/invoiced_at/invoiced_by_*` on **all** included issues in one update.
  - Email body becomes a repair table with the combined total instead of a single repair paragraph.
  - Idempotency: if every eligible issue is already invoiced, return the existing invoice as today.
- `supabase/functions/finalise-public-repair-offer/index.ts`: group pending issues by `inspection_id` and invoke the invoice function once per inspection instead of once per issue.
- `src/services/inspectionService.ts`: `createReceiverInspectionInvoice` takes an optional `inspectionId` and passes it through; staff-side call in `src/pages/BicycleInspections.tsx` sends the inspection id so approving a repair bills the whole bike in one document.
- No schema changes — the per-issue invoice columns already hold the shared invoice details.
