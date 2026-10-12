# Text messages (SMS) for date chasers and timeslots, through Divergent Connect

## What changes

1. **Every dates reminder and timeslot message also goes out as a text message**, alongside the WhatsApp message (not instead of it).
2. Texts come from the sender name **CycleCourie**. Divergent has to approve the name first, so texts only start once it's approved.
3. Each text is **160 characters or fewer** (one text part) and the link is **shortened automatically** to a short dv.gt link. Messages that would run over 160 characters are trimmed rather than split into two texts.
   - Dates: `Cycle Courier Co: please enter 7 dates you're available for your bike collection so we can book it: <link>` (says "delivery" for receivers)
   - Timeslot: `Cycle Courier Co: your bike collection is booked for Tue 13 Oct, 18:00-21:00. Track: <link>` (says "delivery" for delivery slots; for grouped slots, one text per customer)
4. **Delivery tracking:** each text is recorded as sent, delivered or failed.
5. **Replies:** when a customer replies to a text, the reply shows up in the customer service inbox as a ticket, just like WhatsApp replies.
6. The dates-chaser result message also shows how many texts were sent or failed. Test accounts are still skipped.

## What you'll need to do

- Paste your Divergent API key into a secure form I'll show you (please don't paste it in the chat).
- The webhook signing secret is created automatically when I register the webhook, so there's nothing to copy. Divergent says webhooks have to be switched on for your workspace while their new system is in preview. If registering fails, you'll need to ask their support to turn it on.

## Technical details

- Secret `DIVERGENT_API_KEY`, requested with add_secret after approval. The webhook secret is returned once by `POST /v2/webhooks` and stored as `DIVERGENT_WEBHOOK_SECRET` via set_secret.
- New `supabase/functions/_shared/divergentSms.ts`: `sendSms({ recipient, content, clientReference, idempotencyKey })` → `POST https://api.connect.ms/v2/sms` with `sender: "CycleCourie"`, `kind: "transactional"`, `shortenLinks` (default on), `unicode: "strip"`, Idempotency-Key `<orderId>-<type>-<side>-<date>`; uses `POST /v2/sms/preview` only when content is near the limit; content builder enforces 160 GSM chars, allowing 25 per link. UK numbers normalised to +44.
- `chase-missing-dates`: send SMS next to SendZen in each job; add `smsSent/smsFailed` counts; the dashboard toast shows them.
- `send-sendzen-whatsapp`: in the `collection_timeslots`, `delivery_timeslot` and `grouped_timeslot` branches, add the SMS send to the existing `EdgeRuntime.waitUntil` background work; respect the test-account toggle.
- New table `sms_messages` (id, order_id, recipient_masked, type, side, provider_id, status, error, created_at, updated_at): service-role only, GRANT to service_role, RLS on; read policy for admin/cs_agent via user_roles.
- New edge function `divergent-webhook` (verify_jwt = false): verifies RFC 9421 HMAC-SHA256 `Signature`/`Signature-Input` over method, host, path, query, Content-Digest, Content-Type, Webhook-Id; rejects expired signatures; dedupes on Webhook-Id; `sms.delivered`/`sms.failed` update `sms_messages`; `sms.received` creates or appends a customer service ticket via the same matching as `cs-inbound-whatsapp` (phone → contact/order), channel `sms`. Registered once for events `sms.delivered`, `sms.failed`, `sms.received`.
- Customer service replies to SMS tickets: out of scope for now; staff reply by WhatsApp or email as today.
- AGENTS.md: rule that customer SMS goes through the shared Divergent helper, alongside WhatsApp.
- Not verified until real sends happen: sender approval and webhook enablement are on Divergent's side.
