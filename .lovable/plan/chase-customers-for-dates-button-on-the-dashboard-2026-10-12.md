# "Chase customers for dates" button on the dashboard

## What changes

1. When the dashboard filter is set to **Sender dates missing**, **Receiver dates missing** or **Either**, a **Chase customers for dates** button appears above the order list (staff only).
2. Pressing it shows a confirm box: "Send the dates reminder to X customers?" It covers **every** order matching the current filters, not just the visible page.
3. Each customer gets the approved WhatsApp template **dates_chaser**, with their own availability link in the {{1}} slot:
   - Sender missing → the sender gets their collection-dates link.
   - Receiver missing → the receiver gets their delivery-dates link, **only if the sender has already set their dates**. Orders still waiting on the sender are skipped and counted as "waiting on sender".
   - Either → the sender is chased if missing; the receiver only if the sender's dates are set.
4. While sending, the button shows "Sending…" and can't be pressed again. When done, a message says how many were sent, and how many were skipped (no phone number, test account) or failed.
5. Same-side reminders aren't repeated to the same order within 24 hours, so double-pressing on two screens won't spam customers.

## Technical details

- New edge function `chase-missing-dates`: verifies the caller is admin/customer-service staff via `user_roles`; takes the filter (`sender|receiver|either` plus the dashboard's search/status/customer/date filters); re-runs the same missing-dates query server-side with `.range()` pagination and the delivered/cancelled exclusion; reads phone/name from the `sender`/`receiver` JSONB snapshots; skips test accounts; sends via SendZen template `dates_chaser` (lang `en_GB`, one body parameter = `https://booking.cyclecourierco.com/sender-availability/<id>` or `/receiver-availability/<id>`), using the same payload shape as `send-announcement-whatsapp`; processes in `EdgeRuntime.waitUntil` batches and returns counts.
- 24h dedupe using a small log table `date_chase_log (order_id, side, sent_at, status)` with service-role-only access.
- `Dashboard.tsx`: button shown when `filters.missingDates` is set and the user is staff; confirm dialog with count from the current total; sending lock as on the loading list.
