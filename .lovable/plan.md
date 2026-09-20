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

3. **Resend dashboard steps (you do these, ~5 min)** — I'll give you exact values:
   - In Resend → Inbound/Receiving: add your test address (or the subdomain it's on) and add the required MX records in DNS if not already done.
   - Add a webhook for the `email.received` event pointing at:
     `https://api.cyclecourierco.com/functions/v1/cs-resend-inbound`
   - Use the same signing secret already stored as `RESEND_WEBHOOK_SECRET` (or tell me if Resend generated a new one and I'll update it).

4. **Outbound from/reply-to**
   - Keep sending from `Info@notification.cyclecourierco.com` with `reply_to: Info@cyclecourierco.com`, or switch the inbox reply address to your new test address — tell me which the test address is and I'll set it.

5. **Test**: send an email to the test address → confirm it appears in `/inbox` → reply from the inbox → confirm it lands in the sender's mailbox and threads correctly.

## Technical details
- New file: `supabase/functions/cs-resend-inbound/index.ts`
- Refactor: shared receive logic into `supabase/functions/_shared/cs-inbound.ts` (used by both `cs-inbound-email` and `cs-resend-inbound`)
- Optional small edit in `cs-send-message` for the reply-from address
- No database changes, no frontend changes
