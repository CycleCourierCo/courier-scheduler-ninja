# Ferry partner booking email: fix + manual resend

## Why the Shopify order missed the email

Northern Ireland orders created through the customer portal trigger the City Air Express booking email, but orders created via the public `orders` API endpoint (the path Shopify uses) never had that step. So the NI order came in, was flagged correctly as NI, but no notification was ever sent to Operations.man@cityairexpress.com.

## What to build

1. **Send on API/Shopify order creation**
   - Track when the ferry partner was notified on each order (new `ferry_partner_notified_at` field).
   - In the `orders` API function, after an NI order is created, send the booking email to City Air Express and stamp the timestamp.

2. **Shared email template**
   - One shared builder for the ferry partner booking email so the portal path, the API path, and manual resends all produce identical, direction-aware content (outbound to NI vs inbound from NI): order reference, bike details, collection/delivery addresses, ferry contact details.

3. **Resend button**
   - In the Northern Ireland section of the order detail page, add a "Resend ferry partner email" button with a "Last sent" timestamp underneath.
   - Backed by a dedicated edge function so staff can re-trigger the email for any NI order, including backfilling ones that were missed.

## Technical notes

- Migration: add `ferry_partner_notified_at timestamptz` to `public.orders`.
- New shared module `supabase/functions/_shared/ferryPartnerEmail.ts`; used by the `orders` function and a new `send-ferry-partner-notification` function.
- Emails go out through the existing `send-email` function (from `notification.cyclecourierco.com`, reply-to `Info@cyclecourierco.com`).
- Frontend: `src/services/orderServiceUtils.ts` gains a resend helper; `src/components/order-detail/NorthernIrelandEditor.tsx` renders the button and timestamp.
- Sending runs in the background of order creation so Shopify webhook responses stay fast.

## After deploy

Use the resend button on CCC754309893591MARBT2 to send the missed booking email.
