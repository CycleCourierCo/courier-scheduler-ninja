# Ferry partner email missing on Shopify/API Northern Ireland orders

## Why it wasn't sent

There are two order-creation paths and only one of them copies the ferry partner:

- Portal bookings go through `src/services/emailService.ts`. Line 269 sends the receiver notification to `[receiver.email, CITY_AIR_EXPRESS.email]` and includes a "Northern Ireland delivery — receiver details for onward booking" block.
- Shopify bookings go through `supabase/functions/shopify-webhook/index.ts`, which forwards the order into the `orders` edge function. That function sends the receiver email (lines 505-537) to `body.receiver.email` only — no copy to `Operations.man@cityairexpress.com` and no NI details block, even though the same function already sets `is_northern_ireland` and `ni_direction` a few hundred lines earlier.

So any NI order created via Shopify (or the public Orders API) silently skips the ferry partner notification.

## Fix

1. **Orders edge function (`supabase/functions/orders/index.ts`)** — after the NI classification it already computes, send a dedicated ferry partner booking email when `is_northern_ireland` is true:
   - Outbound (mainland → NI): ferry partner receives the NI receiver's name, full address, phone, email, bike details and tracking number, so they can book the onward leg.
   - Inbound (NI → mainland): ferry partner receives the NI sender's collection details instead, using the existing `formatNiSenderBlock` helper style.
   - Sent as its own email to `CITY_AIR_EXPRESS.email` (not a CC on the customer email), so the customer never sees partner-facing wording and the resend button can reuse the exact same template.

2. **Shared template** — put the HTML builder in `supabase/functions/_shared/` next to `northernIreland.ts` so the create path and the resend path produce identical emails.

3. **New edge function `send-ferry-partner-notification`** — takes `{ orderId }`, loads the order, verifies the caller is internal staff (admin/sales), rebuilds the email from the shared template, sends via Resend/`send-email`, and records the send so the UI can show when it last went out.

4. **Resend button** — add "Resend ferry partner email" to `src/components/order-detail/NorthernIrelandEditor.tsx` (the existing Northern Ireland card on the order page), shown only when the order is flagged NI. It calls the new function, shows a success/failure toast, and displays the last-sent timestamp underneath.

## Backfill

Once the button exists, use it on the affected Shopify order so City Air Express gets the booking details.

## Technical notes

- New column on `public.orders`: `ferry_partner_notified_at timestamptz` (nullable) to drive the "last sent" text.
- Direction handling uses the existing `niDirectionOf` / `isInboundNiOrder` helpers in `supabase/functions/_shared/northernIreland.ts`.
- Email uses the standard sender `CCC - Cycle Courier Co. <Ccc@notification.cyclecourierco.com>` with `reply_to: Info@cyclecourierco.com`.
- Portal path stays as-is functionally; it will also call the new function so all three creation routes share one implementation.

## Out of scope

- No change to timeslot WhatsApp/email routing (already goes to the ferry contact).
- No change to the NI surcharge or foam pipeline.
