# Hook the test email address into the CS inbox (receive + send)

Sending already works end-to-end: replies from the inbox go out through `cs-send-message` via Resend with proper threading headers, so replying from the inbox needs no new code. The missing half is **receiving**: getting emails sent to your new test address into the inbox as conversations.

## What exists today
- `cs-inbound-email` edge function: creates the contact, conversation, and message, threads replies via `In-Reply-To`, and auto-links orders. It expects a simple JSON payload (`from`, `subject`, `text`, `html`, `message_id`, `in_reply_to`, `attachments`).
- `cs-send-message`: sends replies from the inbox through Resend (already done).
- Resend's inbound email delivers a **different** payload shape (a signed webhook event), so it can't be pointed straight at `cs-inbound-email` as-is.

## Plan

1. **New edge function `cs-resend-inbound`**
   - Verifies the Resend/Svix webhook signature using the existing `RESEND_WEBHOOK_SECRET` (same pattern as `resend-webhook`).
   - Normalizes Resend's inbound event (`email.received`) into the shape `cs-inbound-email` expects: from, subject, text/html body (fetched from the Resend receiving API using `RESEND_API_KEY` when the webhook only carries metadata), `Message-ID`, `In-Reply-To`, attachments.
   - Calls the existing contact/conversation/message creation logic (shared with `cs-inbound-email`, moved into `_shared/` so both functions use the same code).
   - CORS headers on all responses; no PII in logs.

2. **Deploy** `cs-resend-inbound` (and the refactored shared module).

3. **Resend dashboard steps (you do these, ~5 min)** — using `mail.cyclecourierco.com`:
   - Resend → Domains: confirm `mail.cyclecourierco.com` is verified for **sending** (SPF/DKIM) and has the **MX record** added for receiving.
   - Resend → Inbound/Receiving: route mail for `mail.cyclecourierco.com` (e.g. `support@mail.cyclecourierco.com`) to a webhook.
   - Webhook URL: `https://api.cyclecourierco.com/functions/v1/cs-resend-inbound`, event `email.received`.
   - Signing secret: I'll reuse `RESEND_WEBHOOK_SECRET` if Resend uses the same one; if it generates a new secret for this webhook, paste it and I'll store it as `RESEND_INBOUND_WEBHOOK_SECRET`.

4. **Outbound from/reply-to for the inbox**
   - Change `cs-send-message` so inbox replies send **from** `Customer Service <support@mail.cyclecourierco.com>` with `reply_to` on the same address, so customer replies come straight back into the inbox and thread.
   - Order/notification emails keep using `notification.cyclecourierco.com` — unchanged.

5. **Test**: email `support@mail.cyclecourierco.com` → confirm it appears in `/inbox` → reply from the inbox → confirm it arrives and that the customer's reply threads back into the same conversation.

## Technical details
- New file: `supabase/functions/cs-resend-inbound/index.ts`
- Refactor: shared receive logic into `supabase/functions/_shared/cs-inbound.ts` (used by both `cs-inbound-email` and `cs-resend-inbound`)
- Optional small edit in `cs-send-message` for the reply-from address
- No database changes, no frontend changes
