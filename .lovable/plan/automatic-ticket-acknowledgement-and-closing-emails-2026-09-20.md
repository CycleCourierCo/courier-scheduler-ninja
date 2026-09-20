# Automatic ticket acknowledgement and closing emails

Two new customer emails, both in the portal's branded style, sent from the support inbox address so replies come back onto the same ticket.

## 1. "We've got your message" confirmation

- Sent automatically the moment a **new** ticket is created from an incoming email.
- Not sent when the email is a reply on an existing ticket, so an ongoing back-and-forth doesn't trigger repeats.
- Content: ticket number (e.g. TCK-1042), the subject they wrote in, a line saying the team is looking into it, and typical reply time based on the queue's target. Asks them to reply to the same email to add anything.
- Loop protection: skipped for automated senders (no-reply addresses, bounce/auto-reply mail, our own support address) and only ever once per ticket, recorded on the ticket so a webhook retry can't send twice.
- Logged in the ticket thread as a sent message, marked as automatic, so staff can see exactly what the customer received.
- WhatsApp tickets are unaffected.

## 2. Close ticket button and closing email

- A **Close ticket** button in the ticket header (next to queue/priority/owner). It sets the ticket to closed, clears its reply deadline, and emails the customer.
- Closing email: ticket number, subject, a note that the ticket is now closed, and that replying to the email reopens it.
- Replying after closing already reopens the ticket via the existing ticket-reference threading, so no extra work is needed there.
- If a ticket is closed via the existing status dropdown, the same email is sent, so both routes behave the same.
- Closing a ticket that is already closed does nothing and sends nothing.
- The closing email is also logged in the thread.

## Technical notes

- New shared helper `supabase/functions/_shared/cs-auto-email.ts` building both emails on top of the existing `emailShell`/`emailUI` brand layout, sending via Resend from `support@mail.cyclecourierco.com`, writing an `out` row into `cs_messages` (with `is_automatic` flag) and returning success/failure without throwing into the caller's flow.
- Migration: add `cs_conversations.ack_sent_at`, `closed_at`, `closure_email_sent_at` (nullable timestamps) and `cs_messages.is_automatic` (boolean default false). No policy changes needed; existing RLS and grants cover them.
- `_shared/cs-inbound.ts`: return whether a ticket was newly created, and after ingest fire the acknowledgement for new email tickets only, guarded by `ack_sent_at` and an auto-sender check. Sent inside `EdgeRuntime.waitUntil` so inbound webhook latency is unchanged.
- New edge function `cs-close-ticket`: JWT-verified, admin/`cs_agent` only, sets status `closed` + `closed_at`, clears `next_response_due_at`/`first_response_due_at`, sends the closing email once (`closure_email_sent_at` guard).
- Frontend: `customerServiceInboxService.closeTicket()`, a Close ticket button plus reopen affordance in `ConversationHeader.tsx`, and status-dropdown "closed" routed through the same call so the email always goes out.
- Reply-time wording pulled from the ticket's queue SLA for its priority via `cs_queue_slas`, falling back to a generic "as soon as we can" when no target exists.
