# Pull missed inbound emails from Resend

## What we found

The inbox receiver endpoint has never been called — there are zero logs for it. So the email with ID `53397560-66d6-4372-b1ea-234a284a4d18` did arrive at Resend, but Resend never notified our system, which is why it never appeared in the inbox.

Two things are needed: confirm/complete the Resend notification setup, and add a safety net so a missed notification never means a lost email.

## Plan

1. **Add a "fetch from Resend" sync**
   New backend function that uses Resend's received-email API to list recent received emails, retrieve each one in full (including attachments), and push it through the same inbox ingestion already used by the live notification path. Duplicate protection is already in place, so re-running it is safe.

2. **Recover the specific email**
   Run the sync for `53397560-66d6-4372-b1ea-234a284a4d18` so it lands in the inbox as a normal conversation, linked to the customer and order where possible.

3. **Run it automatically**
   Schedule the sync every 5 minutes so any email Resend fails to notify us about is picked up shortly after, plus a manual "Sync now" button on the inbox for staff.

4. **Check the Resend side**
   Verify the receiving webhook for `mail.cyclecourierco.com` points at the inbox endpoint and is enabled. If the signing secret differs from the one stored, we will ask you for the new one.

## Technical notes

- New function `cs-resend-fetch` (service-role, cron-secret protected): `GET /emails/receiving` and `GET /emails/receiving/{id}` plus `/attachments`, normalised into the existing `InboundEmail` shape and passed to `ingestInboundEmail` in `supabase/functions/_shared/cs-inbound.ts`.
- Reuses `isDuplicateInbound` keyed on `message_id` so webhook and poller cannot double-post.
- Attachment listing/retrieval stored the same way the webhook path stores them.
- Cron via the existing SECURITY DEFINER wrapper pattern; `verify_jwt = false` with `X-Cron-Secret` check, matching current edge-function auth model.
- Keeps a small sync cursor/state row so each poll only walks new emails.
