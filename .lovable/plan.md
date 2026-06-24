## Track timeslot emails sent via SendZen

The "Send Timeslot" button already tags its email (`email_type=timeslot`) and writes an immediate `sent` row into `email_delivery_events`, so the badge appears on the Timeslot card. The **"Send via SendZen"** button also sends an email through Resend, but it does **not** attach tags and does **not** insert a tracking row. That is why no email status shows on the timeslot section after a SendZen send (and any follow-up Resend webhooks land with `email_type=NULL` so the timeslot-scoped badge ignores them).

### Change

**`supabase/functions/send-sendzen-whatsapp/index.ts`** — in the email send block (around line 418):

1. Add `tags` to the `resend.emails.send` call:
   - `email_type` = `"timeslot"`
   - `side` = `recipientType` (`"sender"` or `"receiver"`)
   - `order_id` = `String(orderId)`
2. After a successful send, insert a `sent` row into `email_delivery_events` using the service-role key — mirroring the existing logic in `send-timeslot-whatsapp` (`resend_email_id`, `recipient`, `event_type: 'sent'`, `order_id`, `side: recipientType`, `email_type: 'timeslot'`, `payload: { source: 'send-sendzen-whatsapp' }`).
3. Wrap the insert in `try/catch` so a logging failure never blocks the user flow.

### Out of scope
- No changes to `EmailDeliveryStatus.tsx`, the Resend webhook, or any UI.
- No backfill for previously sent SendZen emails — those rows have no tags and will remain untracked. Any new SendZen send will show the badge progressing Sent → Delivered → Opened → Clicked, and resends will reset it (existing latest-send scoping already handles that).
