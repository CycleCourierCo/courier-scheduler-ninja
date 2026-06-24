## Scope badge to the latest resend

Update `src/components/order-detail/EmailDeliveryStatus.tsx` so the badge reflects only the most recent send (per `resend_email_id`) instead of the cumulative max across all sends.

### Changes

**`src/components/order-detail/EmailDeliveryStatus.tsx`**
1. Extend the query to also select `resend_email_id` (already a column on `email_delivery_events`).
2. After fetching, find the most recent `sent` row for this `order_id` + `side` (+ `email_type` when provided) and capture its `resend_email_id` as `latestSendId`.
   - Fallback: if no `sent` row exists (older data), use the `resend_email_id` of the newest row overall.
3. Filter the events used for ranking/history to only those whose `resend_email_id === latestSendId` (rows without a `resend_email_id` are excluded when a latest id is known).
4. Update the realtime INSERT handler:
   - If the incoming row's `event_type === 'sent'`, treat its `resend_email_id` as the new `latestSendId` and reset `events` to just that row.
   - Otherwise, only append the row if its `resend_email_id === latestSendId`.
5. Keep the tooltip history scoped to the latest send too (so "Sent → Delivered → Opened → Clicked" reflects this resend only).
6. No prop changes; existing usages (`ContactDetails`, `TimeslotSelection`, `OrderDetail`) keep working.

### Behavior after change
- First send: badge progresses Sent → Delivered → Opened → Clicked as before.
- User clicks "Resend": `send-email` / `send-timeslot-whatsapp` inserts a new `sent` row with a new `resend_email_id`. Badge immediately resets to "Sent" and then progresses again as Resend webhooks arrive for the new email id.
- Bounced/complained still surface, but only for the latest send (previous bounces no longer mask a successful resend).

### Out of scope
- No schema changes (`resend_email_id` already exists).
- No edge function changes.
- No UI/visual changes beyond the badge state it shows.
