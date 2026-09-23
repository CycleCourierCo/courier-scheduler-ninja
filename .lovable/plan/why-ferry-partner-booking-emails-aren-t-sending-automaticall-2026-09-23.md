# Why ferry partner booking emails aren't sending automatically

## What the records show

Northern Ireland orders booked by customers through the website are only emailed to City Air Express minutes later, when a staff member presses the resend button:

| Order | Created | Partner emailed |
| --- | --- | --- |
| CCC754213614692BILBT2 (outbound) | 13:06 | 13:22 |
| CCC754796797399DAVBT2 (outbound) | 08:59 | 09:56 |
| CCC754827529846ADADE6 (inbound) | 09:15 | 09:53 |
| CCC754766338457KATBT3 (outbound) | 12:58 | 13:14 |

Orders that come in through the orders API / Shopify are emailed within 2-3 seconds, because that send happens on our server.

## The two causes

1. **The automatic attempt is made from the customer's own browser.** All four orders above were booked by customer accounts. The routine that sends the booking email only accepts requests from signed-in staff, so the customer's attempt is refused and no email leaves. The manual button works because a staff member is signed in.

2. **The inbound safety net only reacts to a day being *changed* later.** It was built for the case where the NI customer picks their collection day after booking. When the collection day is already present at the moment the order is created, nothing fires.

## Change

- Move the trigger onto the server: as soon as a Northern Ireland order is saved, the database itself asks the booking-email routine to run — outbound straight away, inbound as soon as a collection day exists (whether that day arrives with the order or is chosen/edited later).
- Keep it once-only, so the manual resend still can't produce a duplicate and the existing "last sent" record keeps working.
- Leave the existing browser-side attempt in place as a harmless extra; it is no longer the only trigger.
- Nothing changes for API/Shopify orders or the manual resend button.

## Backfill

Send the missed booking email once for the Northern Ireland orders that still have no record of ever being emailed (7 older outbound orders), and confirm today's orders are already covered.

## Technical notes

- New migration: replace `trg_notify_ferry_partner_on_pickup_date` with a trigger firing `AFTER INSERT OR UPDATE OF pickup_date, is_northern_ireland, ni_direction ON public.orders`.
  - Guard: `is_northern_ireland` true, `ferry_partner_notified_at IS NULL`.
  - Outbound: fire on insert (and on an existing order being flagged NI).
  - Inbound: fire when `pickup_date` is a non-empty array; on update also require the value to have changed.
  - Keep the `PERFORM public.invoke_ferry_partner_notification(NEW.id)` call inside its own `BEGIN ... EXCEPTION WHEN OTHERS` so a dispatch failure can never roll back the order.
- `send-ferry-partner-notification` already accepts `X-Cron-Secret` as an internal caller and is idempotent on `ferry_partner_notified_at` — no function or auth change needed.
- `src/services/orderService.ts` and `src/services/availabilityService.ts`: leave the existing fire-and-forget invokes in place (they succeed for staff-entered orders).
- Backfill by invoking the function per order for NI orders with `ferry_partner_notified_at IS NULL`.
