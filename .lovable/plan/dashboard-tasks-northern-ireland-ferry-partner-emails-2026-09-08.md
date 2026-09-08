# Dashboard tasks + Northern Ireland ferry partner emails

## 1. Show tasks on the dashboard

Add the personal "My tasks" panel back to the dashboard for internal staff — the same panel used on the home page (your own open tasks, with the task detail drawer). Customer accounts still don't see it.

## 2. Fix the missing ferry partner email (CCC754459016470SEABH1)

What the records show: this order was created at 10:10 and the ferry partner was only notified at 16:18 — the manual send. The two comparison orders were notified within seconds of creation.

Cause: the ferry partner booking email is only sent when an order arrives through the orders API / Shopify route. Orders booked through the website's own Create Order screen set the Northern Ireland flags but never trigger that email.

Fix: after a Northern Ireland order is created on the website (including bulk upload), automatically send the same ferry partner booking email and stamp the "notified" time, exactly as the API route does. It stays a one-time send — if the time stamp is already set, it won't send again, so the manual button still works as a backup and can't double up.

## 3. Emails to City Air Express for inbound (NI to England) orders

Today, inbound orders send City Air only the one booking email at order creation. The collection-date request and the confirmed-collection-dates emails go to the Northern Ireland sender alone, so the partner is never told the date they must collect in NI.

Change: for inbound orders, copy City Air Express on the confirmed-collection-dates email, so they get the agreed collection date for the NI pickup. The sender keeps receiving their own emails unchanged, and outbound behaviour (delivery emails going to City Air instead of the NI receiver) stays as it is.

## Technical notes

- `src/pages/Dashboard.tsx`: re-add `MyTasksPanel`, gated on internal staff roles as on `Index.tsx`.
- `src/services/orderService.ts`: after a successful insert where `is_northern_ireland` is true, invoke `send-ferry-partner-notification` (fire-and-forget, non-blocking); that function already builds the direction-aware email and sets `ferry_partner_notified_at`. Add the same call to `src/services/bulkOrderService.ts`.
- `supabase/functions/send-ferry-partner-notification/index.ts`: skip when `ferry_partner_notified_at` is already set unless an explicit `force` flag is passed (used by the manual button in `NorthernIrelandEditor.tsx`).
- `src/services/emailService.ts` `sendSenderDatesConfirmedEmail`: for `getNiDirection(order) === 'inbound'`, add `CITY_AIR_EXPRESS.email` as a cc recipient with the NI collection address block.
