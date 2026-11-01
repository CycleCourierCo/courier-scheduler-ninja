# How closing a ticket works, and what to improve

## How it works today
**Email tickets**
- Clicking Close marks the ticket closed and emails the customer once to say it's closed.
- Replies are locked until someone clicks Reopen.
- If the customer emails again, a new ticket starts.

**WhatsApp tickets**
- Clicking Close marks it closed, but **nothing is sent to the customer**. The closing email only goes to email tickets.
- The pop-up still says "the customer has been emailed", which is wrong.
- If the customer messages again, the app starts a **new ticket** (new TCK number) instead of reopening the old one.

## Proposed changes
1. **Choice when closing** (both channels): "Close and let the customer know" or "Close quietly". Quiet is useful for chats like TCK-1006 that end with "thanks".
2. **WhatsApp closing message**: if the customer messaged in the last 24 hours, send a short WhatsApp: "Thanks for chatting with Cycle Courier Co. We've marked this conversation as resolved (ref TCK-xxxx). Just reply here if you need anything else." Outside 24 hours, WhatsApp doesn't allow free text, so it closes quietly and says so.
3. **Correct pop-up wording**: "Closed and customer emailed", "Closed and customer sent a WhatsApp", or "Closed (customer not notified)".
4. **Customer replies after closing**: if they reply within 7 days, reopen the same ticket so the history stays together. After 7 days, start a new ticket. This applies to both email and WhatsApp.
5. The closing message appears in the chat thread like other messages, so staff can see it was sent.

## Technical details
- `cs-close-ticket`: accept `notify`; for `channel = 'whatsapp'` send via the existing outbound WhatsApp helper when the last inbound message is within 24h; insert an outbound `cs_messages` row; return `{ notified: 'email' | 'whatsapp' | null }`.
- `ConversationHeader`: small confirm with the two buttons; toast reads the returned `notified`.
- `cs-inbound-whatsapp` / email inbound: when no open ticket, reopen the latest closed one if `closed_at` is within 7 days, else create a new one.
- Add vitest cases for the 24h and 7-day rules.
