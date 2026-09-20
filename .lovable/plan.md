# Block replies on closed tickets until reopened

## What changes

1. **Reply box is locked on closed tickets.** When the open ticket's status is `closed`, the reply composer is replaced with a notice: "This ticket is closed. Reopen it to reply." Typing, instant responses, and the send button are all unavailable. Internal notes are also blocked on closed tickets (same rule), so nothing new can be added until reopened.

2. **Reopen ticket button.** The ticket header gains a "Reopen ticket" action (shown only when the ticket is closed, next to where "Close ticket" appears today). Clicking it sets the status back to `open`, which immediately unlocks the composer. No email is sent on reopen.

3. **Server-side guard.** `cs-send-message` rejects sends to closed conversations with a clear error, so a reply can't slip through even if the UI is bypassed or a stale page is open. Reopening is done via the existing `updateConversation` path (status `open`, clear `closed_at` and `closure_email_sent_at` so a later close emails the customer again).

4. **Behaviour after reopening.** Replying then works exactly as before — the message sends and the ticket moves to `pending`. If the customer emails in on a closed ticket, inbound still threads it onto the same ticket and reopens it automatically (unchanged).

## Technical notes

- `src/pages/CustomerServiceInbox.tsx`: pass `conversation.status` down to `MessageComposer`; disable composer when `closed`, show the notice, hide canned-response picker/suggestions.
- `src/components/inbox/MessageComposer.tsx`: accept a `disabled`/`closedReason` prop; block send + template insert while closed.
- `src/components/inbox/ConversationHeader.tsx`: render "Reopen ticket" when `status === 'closed'`; call `updateConversation(id, { status: 'open', closed_at: null, closure_email_sent_at: null })` and refresh queries.
- `supabase/functions/cs-send-message/index.ts`: after loading the conversation, return 409 `{ error: 'ticket_closed' }` when `conv.status === 'closed'`; deploy updated function.
- No database migration or RLS changes needed.
