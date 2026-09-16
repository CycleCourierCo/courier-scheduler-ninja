# Send the City Air booking email automatically when an NI customer picks their collection day

## What happened on CCC754609415384GARNW3

The customer chose Sunday 20 September at 15:34. The booking email to City Air only went out at 15:37 — when it was sent manually.

The automatic attempt is made from the customer's own browser as soon as they submit their day. But the routine that sends that booking email only accepts requests from logged-in staff. A customer on the emailed availability link isn't staff, so the request is refused and no email leaves. The manual button works because a staff member is signed in.

There is a second, smaller problem on the same path: the automatic attempt is fired without waiting for it, so even for staff it can be cut off when the page moves on right after submitting.

## Change

- Move the trigger to the server: when the collection day is saved for an inbound Northern Ireland order, the database itself asks the booking-email routine to run, using the same trusted internal call already used for the receiver availability email on that path.
- Keep the send once-only, so a later manual resend still doesn't duplicate and the existing "already notified" record continues to work.
- Keep the customer-side attempt as a harmless fallback but stop it from being the only trigger.
- Nothing changes for outbound Northern Ireland orders (still emailed at booking) or for the manual resend button.

## Backfill

CCC754609415384GARNW3 already has its email (sent manually), so no resend. Check for other inbound NI orders that have a confirmed collection day but no booking email recorded, and send those once.

## Technical notes

- `set_order_availability` (sender branch): after the update, when `is_northern_ireland` and `ni_direction = 'inbound'`, `PERFORM net.http_post` to `send-ferry-partner-notification` with `X-Cron-Secret` (fetched through the existing secret-injection wrapper pattern, same as other cron-invoked functions) and body `{ orderId }`, wrapped in its own `BEGIN ... EXCEPTION WHEN OTHERS` so a failure can never roll back the saved dates.
- `send-ferry-partner-notification/index.ts` already accepts `X-Cron-Secret` as an internal caller and is idempotent on `ferry_partner_notified_at`; no auth change needed there.
- `src/services/availabilityService.ts`: leave the existing `isInboundNi` invoke in place (it succeeds for staff-entered dates) — the server call is now the reliable path.
- Backfill query: inbound NI orders with `pickup_date` non-empty and `ferry_partner_notified_at IS NULL`, then invoke the function per order.
