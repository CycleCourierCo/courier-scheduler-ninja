# Resend the ferry partner email for CCC754872802020GORCV3

Order `CCC754872802020GORCV3` (Gordon Todd -> Kevin Costigan) is flagged as an inbound Northern Ireland job (NI to England), status `created`, and `ferry_partner_notified_at` is empty, so City Air Express has no recorded booking email for it.

## Action

Trigger the existing `send-ferry-partner-notification` function for this order (order id `1ba18a7b-7108-4efa-bb31-bcbb3b1462b0`). No code changes.

This sends the booking email to City Air Express with:
- Subject prefixed `NI to England - collection booking CCC754872802020GORCV3`
- The NI-side party (Gordon Todd's collection address, since this is inbound)
- The direction label in the email body
- Bike details and tracking number

The function then stamps `ferry_partner_notified_at`, so the order detail page will show "Last sent ..." next to the "Resend ferry partner email" button.

## Verification

Confirm a 200 response with the recipient and direction returned, then re-check that `ferry_partner_notified_at` is populated on the order.
