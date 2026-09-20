# Bigger chat area + closure email on every close

## 1. Make the chat space much larger

Today the inbox is squeezed into a fixed block under the page heading, so the chat column is small on a laptop screen.

Changes on the Customer Service inbox page:
- Let the inbox fill the whole browser window height instead of a short fixed block, with the ticket list, chat and contact panel each scrolling on their own.
- Trim the page heading/toolbar area above the inbox so almost all vertical space goes to the conversation.
- Give the chat the dominant share of the width: narrower ticket list, and the right-hand contact/order panel becomes collapsible (hidden by default on smaller screens, toggled by a button).
- Add a full-screen toggle for the chat so a ticket can be read with the list and side panel hidden entirely.
- Messages get more room: wider bubbles and a roomier reply box, with the composer staying pinned to the bottom.

## 2. Closure email not sending on a re-close

Confirmed cause from the ticket you just closed (TCK-1003): the closure email was already sent at 20:53 on an earlier close. The customer then replied, which reopened the ticket, and when you closed it again at 21:04 the system saw "closure email already sent" and skipped it. It is not related to who replied last.

Fix:
- Treat the closure email as once per closure, not once per ticket: send it whenever the recorded closure email is older than the current closure time.
- When an inbound reply reopens a closed ticket, clear the previous closure and acknowledgement markers so the next close emails again.
- Keep the existing safeguards: one email per closure, never to automated senders, and always on the same email thread as the rest of the ticket.

## Technical notes

- `src/pages/CustomerServiceInbox.tsx`: replace `h-[calc(100dvh-240px)]` grid with a full-height flex layout (`h-[calc(100dvh-var(--header))]`), narrower list column, collapsible context column, focus-mode state.
- `src/components/inbox/MessageThread.tsx`: widen bubble max-width, larger composer, keep `overflow-y-auto` + `min-h-0`.
- `supabase/functions/_shared/cs-auto-email.ts`: change the `sendTicketClosedEmail` claim from `.is('closure_email_sent_at', null)` to a claim allowing re-send when `closure_email_sent_at < closed_at`.
- `supabase/functions/_shared/cs-inbound.ts`: on reopening a closed conversation, null `closure_email_sent_at` (and `ack_sent_at` where appropriate).
- Redeploy `cs-close-ticket`, `cs-inbound-email`, `cs-resend-inbound`, `cs-resend-fetch`, `cs-send-ack`.
