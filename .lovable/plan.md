## What's happening

The Route Builder's "SZ" / grouped send buttons call the **`send-sendzen-whatsapp`** edge function (RouteBuilder lines ~2704, 2816, 2867) — not `send-timeslot-whatsapp`.

`send-timeslot-whatsapp` already redirects Northern Ireland delivery legs to the ferry hand-off contact. `send-sendzen-whatsapp` has no Northern Ireland logic at all: it picks `order.receiver` whenever `recipientType === "receiver"` (line 516) and emails `contact.email` (line 420), so the WhatsApp and email went to the Northern Ireland customer.

## Change

Only `supabase/functions/send-sendzen-whatsapp/index.ts` changes — mirror what the other function already does:

1. Import `CITY_AIR_EXPRESS`, `isNorthernIrelandAddress`, `formatNiReceiverBlock` from `../_shared/northernIreland.ts` and add the same `isNiOrder(order)` / `niHandoffContact()` helpers.
2. Where the primary contact is chosen: if `recipientType === "receiver"` and the order is Northern Ireland, use the hand-off contact (name, phone `+44 7730 145621`, email `operations.man@cityairexpress.com`, Manchester address) instead of `order.receiver`. WhatsApp number, template contact name and email recipient all follow from this one contact object.
3. Related jobs in a grouped send (line ~213): each job resolves its own contact the same way — pickup legs use the sender, delivery legs on Northern Ireland orders use the hand-off contact, everything else unchanged. The Shipday update and `customerEmail` in that block use the resolved contact too.
4. Email body for a Northern Ireland delivery includes the final-destination block (`formatNiReceiverBlock`) so the hand-off contact knows which customer the bike is for; the customer-facing "you'll get a tracking link" line is dropped for that case.
5. Deploy the function.

## Behaviour after

Any timeslot sent from the Route Builder for a ferry hand-off stop — single or grouped — messages only the operations email and mobile above. Non-Northern-Ireland deliveries and all collections are untouched.
