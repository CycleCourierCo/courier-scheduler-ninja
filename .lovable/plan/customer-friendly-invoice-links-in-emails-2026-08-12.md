# Customer-friendly invoice links in emails

Right now every invoice email links to `qbo.intuit.com/app/invoice?txnId=...` — that is the QuickBooks *admin* screen, so only the account holder can open it. QuickBooks does expose a public shareable link (`InvoiceLink`) on an invoice, but only when online invoicing/payments is enabled for the company file, so we combine three layers.

## What customers will get

For every invoice email we send (weekly customer invoices, inspection repairs, receiver-billed repairs, guaranteed delivery, box-my-bike, inspection service):

1. **Public "View & pay invoice" button** — the QuickBooks shareable link, fetched straight after the invoice is created.
2. **PDF attached** to the same email, always, so the customer has the invoice even if the link is unavailable or expires. If no public link came back, the email text points at the attachment instead of showing a dead button.
3. **QuickBooks also sends its own invoice email** to the billing email address, giving the customer Intuit's branded email with the pay-now link (a safety net and a proper QuickBooks "sent" status on the invoice).

Admin screens keep using the existing QuickBooks admin link, so staff still land on the editable invoice in QuickBooks.

## Technical details

New shared helper `supabase/functions/_shared/quickbooksInvoiceDelivery.ts`:
- `getInvoicePublicLink(token, companyId, invoiceId)` — `GET /v3/company/{id}/invoice/{invoiceId}?include=invoiceLink`, returns `Invoice.InvoiceLink` or null.
- `getInvoicePdfBase64(token, companyId, invoiceId)` — `GET /v3/company/{id}/invoice/{invoiceId}/pdf` with `Accept: application/pdf`, returned base64 for Resend attachments.
- `sendInvoiceViaQuickBooks(token, companyId, invoiceId, email)` — `POST /v3/company/{id}/invoice/{invoiceId}/send?sendTo={email}`; failures are logged and never break the flow.
- All three are best-effort: any non-OK response logs status + body and returns null/false.

Database migration (nullable text columns, no behaviour change on existing rows):
- `orders`: `quickbooks_invoice_public_url`, `guaranteed_delivery_invoice_public_url`, `box_my_bike_invoice_public_url`
- `inspection_issues`: `invoice_public_url`
- `bicycle_inspections`: `invoice_public_url`
- `invoice_history`: `quickbooks_invoice_public_url`

Edge functions updated to call the helper after invoice creation, persist the public link alongside the existing admin URL, attach the PDF to the Resend email, and trigger the QuickBooks send:
- `create-quickbooks-invoice`
- `create-inspection-invoice`
- `create-receiver-inspection-invoice`
- `create-guaranteed-delivery-invoice`
- `create-box-my-bike-invoice`
- `create-inspection-service-invoice`

Email bodies: the customer-facing CTA uses the public link when present, otherwise the copy switches to "your invoice is attached as a PDF". Resend attachment uses `{ filename: 'invoice-<number>.pdf', content: <base64> }`.

Frontend: badges/links in `InvoicesPage.tsx`, `BicycleInspections.tsx` and `GuaranteedDeliveryCard.tsx` stay on the admin QuickBooks URL; where a public link exists, add a small secondary "Customer link" action so staff can copy the link a customer can open.
