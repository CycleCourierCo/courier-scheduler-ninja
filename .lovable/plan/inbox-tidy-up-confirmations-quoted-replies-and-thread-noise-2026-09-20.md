# Inbox tidy-up: confirmations, quoted replies, and thread noise

Three fixes to the customer service inbox.

## 1. No confirmation email after you've already replied or closed

Right now the five-minute mailbox check will send a "we've got your message" email to any recent ticket that hasn't had one — even if you already answered it by hand or closed it. That looks careless to the customer.

Changes:
- When you send a reply, or close a ticket, the ticket is marked as no longer needing an automatic confirmation.
- The five-minute retry only confirms tickets that are still unanswered and not closed.
- The "Send confirmation" button in the ticket header still works if you deliberately want to send one.

Tickets that arrive by webhook are still confirmed instantly, as now; the retry is only a safety net for mail picked up by the scheduled check.

## 2. Replies should not include our previous email

When a customer replies, their email carries our whole previous message quoted underneath. The inbox should only show what they actually wrote.

Incoming messages will have the quoted history trimmed before being stored:
- The "On <date>, <name> wrote:" style attribution line and everything after it.
- Lines beginning with ">".
- Common client separators ("-----Original Message-----", "From: ... Sent: ...", Gmail/Outlook quote blocks in the HTML version).

If trimming would leave the message empty, the full text is kept so nothing is ever lost. The original email stays intact in Resend.

## 3. The "your ticket is with us" email becomes a small line

The automatic confirmation currently fills the thread as a full blue message. It becomes the same compact centred line as the closure notice — "Confirmation sent to the customer" — clickable to see the email that went out. Existing confirmation messages already in threads get relabelled too, so old tickets tidy up as well.

## Technical notes

- `cs-auto-email.ts`: the acknowledgement send passes `systemEvent: "ticket_acknowledged"`; `SYSTEM_LABELS` in `MessageThread.tsx` gains that key.
- One data update marks existing automatic confirmation messages with the new system event (matched on `is_automatic` plus subject/body signature, `system_event` null).
- `cs-inbound.ts`: add a `stripQuotedReply()` helper applied to `body.text` and the HTML before sanitising; used by both inbound paths (webhook and `cs-resend-fetch`).
- `cs-send-message` and `cs-close-ticket` set `ack_sent_at = now()` when it is null, so the sweep skips them.
- `cs-resend-fetch`: the ack sweep additionally requires no outbound message on the conversation and `status <> 'closed'`.
- Deploy: `cs-inbound-email`, `cs-resend-inbound`, `cs-resend-fetch`, `cs-send-message`, `cs-close-ticket`, `cs-send-ack`.
