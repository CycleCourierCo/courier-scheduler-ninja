# Workshop-only inspections, and choosing who approves repairs

## 1. Add an inspection without a transport job

On Bicycle Inspections, a new "New workshop inspection" button opens a short form:

- Customer name, email, phone (email required — that's where approvals and the invoice go)
- Bike make, model, frame size, bike category, optional reference/notes

This creates an inspection with no job attached. It then behaves like any other inspection: PDI checklist, issues with prices, parts, repair stages, cleaning, report PDF, invoicing.

Because there's no customer login for a walk-in, the approval goes out as a **public link** (same idea as the receiver repair offer): the customer opens the emailed link, sees each recommended repair with its price and the report, and approves or declines per repair. Their responses land in the workshop exactly like portal approvals.

Cards for these show a "Workshop only" badge and the customer's name instead of a tracking number, and they never appear in job scheduling, loading lists or route planning.

## 2. Choose who the repairs go to

When releasing repairs for approval, the mechanic picks the recipient:

- Booking account (current behaviour)
- Receiver / buyer — they get the public approval link and pay for what they approve
- The walk-in customer (only option for workshop-only inspections)

For Shopify-created inspections the recipient dialog defaults to the receiver (the buyer), since the shop isn't paying for repairs. The card records who it was sent to and when, and re-send uses the same choice unless changed.

## 3. Invoicing

Raising the invoice for a workshop-only inspection opens a customer details step pre-filled from the inspection (name, email, optional company and billing address). Staff confirm or correct it, then:

- match an existing QuickBooks customer by that email, otherwise
- create the QuickBooks customer from the details entered,

then raise the repair invoice against them and email it with the pay link and PDF, as today. Receiver-approved repairs continue to use the existing receiver invoice path.

## Technical notes

Database (one migration):

- `bicycle_inspections`: make `order_id` nullable; add `customer_name`, `customer_email`, `customer_phone`, `customer_company`, `customer_address` (jsonb), `bike_brand`, `bike_model`, `frame_size`, `reference`, `is_workshop_only` (generated as `order_id IS NULL` in code, not a column), `approval_recipient` (`customer` | `receiver` | `walkin`), `approval_sent_to_at`, plus a check that either `order_id` or `customer_email` is present.
- `inspection_issues.order_id` also becomes nullable (issues are already keyed by `inspection_id`).
- Two `security definer` RPCs mirroring the repair-offer pattern, keyed on the inspection UUID: `get_public_inspection_approval(p_inspection_id uuid)` and `submit_public_inspection_approval(p_inspection_id uuid, p_approved_issue_ids uuid[])`. `execute` to `anon`/`authenticated`; no new `anon` table grants.
- Audit existing inspection queries that assume a non-null `order_id` (`getPendingInspections`, order joins, servicing gate, boxing/foaming and availability gates) and exclude workshop-only rows from them.

Frontend:

- `src/components/inspections/NewWorkshopInspectionDialog.tsx` (create form) and a recipient picker dialog; wired into `src/pages/BicycleInspections.tsx` alongside a "Workshop only" tab/filter.
- New public page `src/pages/InspectionApproval.tsx` at `/inspection-approval/:id`, modelled on `src/pages/RepairOffer.tsx`.
- `src/services/inspectionService.ts`: `createWorkshopInspection`, `setApprovalRecipient`, public fetch/submit helpers; existing helpers made tolerant of a null `order_id`.
- `src/types/inspection.ts`: new fields; `order` stays optional.

Edge functions:

- `send-inspection-approval`: accept a recipient (`customer` | `receiver` | `walkin`); for receiver/walk-in send the public `/inspection-approval/<id>` link using the receiver snapshot or the inspection's customer details; keep test-account suppression, HTML escaping and no PII in logs.
- `create-inspection-invoice`: accept optional customer details for workshop-only inspections — QuickBooks lookup by that email, create the customer when absent, and use it as the invoice `BillEmail`; existing order-based candidate chain unchanged.
- Deploy both.
