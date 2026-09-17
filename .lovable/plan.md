# Bill the sender or receiver when no invoicing account is found

Today, if inspection invoicing can't match a billing account, the "Choose billing customer" box only lets staff search existing QuickBooks customers. If neither the sender nor the receiver exists there yet, there is no way forward.

## What changes

When no account matches, the dialog now offers three routes:

1. **Bill the sender** — shows the sender's name, company, email and phone from the job, with a "Bill the sender" button.
2. **Bill the receiver** — same, using the receiver's details.
3. **Search existing customers** — unchanged.

Picking the sender or receiver:
- Reuses their existing QuickBooks account if one is found by email or name.
- Otherwise creates a new QuickBooks customer from the job's details (name/company, email, phone, address) and invoices that.
- The billing email field stays available to override which address the invoice goes to.

If the chosen side has no email on the job, the button is disabled with a short note that an email is needed, and staff can still type one in the billing email field to proceed.

## Technical details

`supabase/functions/create-inspection-invoice/index.ts`
- In the `409 customer_not_matched` response, add a `parties` object with sanitised sender and receiver contact details (name, company, email, phone, address lines, city, postcode) taken from the order's `sender`/`receiver` JSONB snapshots.
- Accept a new body field `billFrom?: 'sender' | 'receiver'`. When set, build the payer from that side of the order snapshot (merged with any `billingEmailOverride`), reorder the email/name candidate lists so that party is tried first, and — if still unmatched — create the QuickBooks customer from those details.
- Lift the existing workshop-only customer-creation block into a small helper so it serves both walk-ins and this new sender/receiver path (same DisplayName/GivenName/BillAddr payload, `Country: 'United Kingdom'`, name-collision suffix with the email if QuickBooks rejects a duplicate DisplayName).
- Keep the current QuickBooks string escaping and the idempotent "invoice already created" guard untouched.

`src/components/inspections/BillingCustomerDialog.tsx`
- New optional `parties` prop (`{ sender?: PartyDetails; receiver?: PartyDetails }`).
- Render two party cards above the search box, each showing the name/company and email and a "Bill the sender" / "Bill the receiver" button.
- `onConfirm` gains an optional `billFrom` field so the page knows which route was taken.

`src/pages/BicycleInspections.tsx`
- Store `parties` in `billingDialogState` from the 409 payload and pass it to the dialog.
- `createInvoiceMutation` accepts and forwards `billFrom`.

No schema changes. Same admin-only access check as today.
