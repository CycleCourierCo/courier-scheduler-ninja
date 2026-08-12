# Auto-create QuickBooks invoice for receiver-approved repairs

When staff click **"Receiver approved, do this repair"** on a declined inspection issue, the system will immediately create a separate QuickBooks invoice billed to the receiver and send them an email with the invoice link. The repair is still excluded from the booking customer's invoice.

## What changes

### Database

Add per-issue invoice tracking to `inspection_issues`:

- `invoice_number` (text)
- `invoice_id` (text)
- `invoice_url` (text)
- `invoiced_at` (timestamptz)
- `invoiced_by_id` (uuid)
- `invoiced_by_name` (text)

### Edge function: `create-receiver-inspection-invoice`

New Supabase edge function invoked by staff when approving a repair for the receiver.

- Validates JWT and admin/mechanic role.
- Accepts `issueId`.
- Loads the issue, its inspection, and the order.
- Verifies the issue is `status = 'approved'` and `billing_party = 'receiver'`.
- Uses the order's `receiver` JSONB (name, email) as the payer.
- Looks up the receiver in QuickBooks by email; if not found, creates a new customer with the receiver's name and email.
- Creates a QuickBooks invoice using the existing "Bike Repair" product:
  - Net price = `estimated_cost / 1.2` (VAT-exclusive).
  - Line description includes tracking number, bike brand/model, and issue description.
- Updates the `inspection_issues` row with `invoice_number`, `invoice_id`, `invoice_url`, `invoiced_at`, `invoiced_by_id/name`.
- Sends the receiver an email via Resend with the QuickBooks invoice link and a short explanation that payment is due directly to Cycle Courier Co.
- Returns invoice metadata to the frontend.

### Frontend

- `src/services/inspectionService.ts`: add `createReceiverInspectionInvoice(issueId)` helper.
- `src/pages/BicycleInspections.tsx`: update the `receiverApproveMutation` so after marking the issue receiver-approved, it calls the new edge function and shows:
  - "Repair approved by receiver and invoice <number> created" toast with an Open link.
  - Error toast if the invoice fails, but the approval itself is preserved.
- On the issue card, display a **Receiver invoice: #XXX** badge/link when `invoice_number` is set.

### Email

- Uses the existing Resend configuration.
- Sender: `CCC - Cycle Courier Co.` from `notification.cyclecourierco.com`.
- Reply-to: `Info@cyclecourierco.com`.
- Subject: "Invoice for your bike repair — CCC <tracking number>".
- Body explains the repair was approved by the receiver, the amount, and includes the QuickBooks invoice link.

## Behaviour rules

- Only receiver-approved issues (`billing_party = 'receiver'`) are invoiced this way.
- Customer-billed issues remain unchanged and are handled by the existing inspection invoice flow.
- If QuickBooks is not connected or the receiver has no email, the approval is still recorded but the invoice creation fails with a clear error message.
- Undoing a receiver approval also clears the invoice fields so the issue can be re-offered or re-billed later if needed.
- If an invoice already exists for the issue (`invoice_number` is set), the function returns the existing invoice rather than creating a duplicate.

## Technical details

- QuickBooks auth, token refresh, VAT tax-code lookup, and "Bike Repair" product lookup are reused from the existing `create-inspection-invoice` function logic.
- Customer creation in QuickBooks uses the receiver's name and email; if a name collision occurs, the display name is suffixed with the receiver's email to avoid duplicates.
- The function runs synchronously from the frontend so the invoice link is available immediately in the toast.
- Resend API key is read from `Deno.env.get('RESEND_API_KEY')`; no new secrets are expected unless the key is missing.
