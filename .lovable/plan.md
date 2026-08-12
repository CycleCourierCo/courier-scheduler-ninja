# Guaranteed Delivery Date charge on an order

Add an admin-only button on the order detail page that marks an order as "Guaranteed date delivery", asks who pays, asks the extra amount, and bills it accordingly.

## Flow

1. Admin opens an order → clicks **Guaranteed date delivery** (admin only, internal — nothing shown on customer tracking).
2. A dialog asks:
   - **Who is paying?** Booking account / Sender / Receiver
   - **Extra amount (net, ex-VAT)** — starts at 0, staff type the agreed figure
   - Optional note
3. On confirm:
   - **Booking account** → the flag + amount are stored on the order and picked up automatically as an extra line on that customer's weekly invoice (and the "create invoice" button / cron path — all three use the same invoice builder).
   - **Sender / Receiver** → a standalone QuickBooks invoice is created immediately using that party's name, email and address, and the invoice number/link is stored on the order and shown as a badge next to the button.
4. Admin can undo the flag; undoing clears the amount and, if a standalone invoice was raised, keeps the invoice reference visible with a warning (QuickBooks invoices are not auto-voided).

The date itself is not picked — the flag simply records that the delivery date is guaranteed.

## QuickBooks

A product named exactly **Guaranteed Delivery Date** must exist in QuickBooks. The line uses the amount staff entered (VAT applied the same way as existing lines). If the product is missing, the action fails with a clear message rather than inventing a line.

## Technical details

Database migration on `public.orders`:
- `guaranteed_delivery` boolean default false
- `guaranteed_delivery_payer` text (`account` | `sender` | `receiver`)
- `guaranteed_delivery_amount` numeric default 0
- `guaranteed_delivery_note` text
- `guaranteed_delivery_marked_at`, `guaranteed_delivery_marked_by_id`, `guaranteed_delivery_marked_by_name`
- `guaranteed_delivery_invoice_number`, `guaranteed_delivery_invoice_id`, `guaranteed_delivery_invoice_url`, `guaranteed_delivery_invoiced_at`

Frontend:
- New `src/components/order-detail/GuaranteedDeliveryCard.tsx` (button, status badge, invoice link) rendered in `src/pages/OrderDetail.tsx` for admins only.
- New dialog component for payer + amount confirmation, using existing shadcn dialog/radio/input patterns.
- Service helpers in `src/services/orderService.ts` to set/clear the flag and invoke the invoice function.

Edge functions:
- New `supabase/functions/create-guaranteed-delivery-invoice/index.ts` — admin-auth, QuickBooks token refresh, find-or-create customer for the sender/receiver, single line item from the `Guaranteed Delivery Date` product at the entered amount, store invoice refs on the order. Modelled on `create-box-my-bike-invoice`.
- `supabase/functions/create-quickbooks-invoice/index.ts` — when `guaranteed_delivery` is true and payer is `account`, append one `Guaranteed Delivery Date` line per order at the stored amount. This covers the weekly cron, "create all", and per-customer buttons since they all call this function.

No changes to customer-facing tracking.
