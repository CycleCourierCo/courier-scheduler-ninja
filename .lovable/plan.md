# Ticket threading rules + reply delivery status

## How threading works today (verified in the inbound handler)

An incoming email is matched to an existing ticket in this order:

1. The hidden reply header on the email (it points at the exact earlier message we sent).
2. A ticket number like `TCK-1042` found in the subject line.
3. Failing both, the sender's most recent ticket that is still **Open** or **Pending**.

So a January email answered and **closed** would not catch a September email — closed tickets are excluded from step 3, and a fresh ticket is created. The risk is the middle case: a January ticket left Open or Pending forever, where an unrelated September email silently joins it.

## Proposed change 1: time-box the fallback match

- Keep steps 1 and 2 exactly as they are (reply header, then ticket number) — these are reliable at any age.
- Step 3 only reuses an open/pending ticket when its last message is recent (default 14 days) **and** the subject looks related. Otherwise a new ticket is created, linked to the same customer so agents can see their history.
- Add a "Previous tickets from this customer" list in the conversation side panel, so separate tickets stay separate but the context is one click away.
- Make the 14-day window an admin setting on the queue settings page.

## Proposed change 2: show delivery status on each reply

Today a separate webhook already records Resend delivery events, but only for order emails — nothing ties them to inbox replies.

- When a reply is sent, store the Resend email id on that message and tag it with the ticket and message.
- Extend the existing Resend event webhook so delivery, open, click, bounce, and complaint events update the matching reply.
- Show a small status under each outgoing reply: Sending, Sent, Delivered, Opened, Bounced, Spam complaint, with the time. Bounces and complaints also flag the ticket so an agent notices.

Caveat to be clear about: "Opened" depends on the recipient's email client loading a tracking pixel, so it is a best-effort signal — many clients block it. "Delivered" and "Bounced" are reliable.

## Technical notes

- `_shared/cs-inbound.ts`: add recency + subject-similarity guard to the open/pending fallback; keep `in_reply_to` and `TCK-` matching first.
- Migration: `cs_messages.provider_message_id`, `cs_messages.delivery_status`, `delivery_events jsonb`, `cs_conversations.has_delivery_problem`; setting row for the reuse window.
- `cs-send-message`: persist `data.id` from Resend, pass `tags: { cs_conversation_id, cs_message_id }`.
- `resend-webhook`: when `cs_message_id` tag (or matching `resend_email_id`) is present, update `cs_messages.delivery_status` and append to `delivery_events`; keep current order-email behaviour untouched.
- Frontend: status line in the message thread, warning badge in the conversation header, previous-tickets list from `cs_conversations` by `contact_id`.
