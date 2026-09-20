# Inbox: confirmation email, delivery ticks, tidier closure note

## 1. Why the "we've got your message" email didn't arrive

Ticket TCK-1001 was created at 18:54, before the confirmation email feature went live, and its confirmation flag is still empty — so nothing was ever sent for it. New tickets created since then do go through the new path, but two gaps are worth closing:

- Tickets picked up by the five-minute mailbox check (rather than the live webhook) should also trigger the confirmation.
- If a confirmation fails or was missed, there should be a way to send it: a small "Send confirmation" action in the ticket header for staff, and the background check retries any open ticket that still has no confirmation and is under an hour old.

Also add a test path so the next inbound email can be confirmed end to end, and log a clear entry when the confirmation send fails.

## 2. Ticks for sent / delivered / read

- Every outgoing reply and automatic email stores its Resend id and is tagged with the ticket and message.
- The existing Resend event webhook is extended so delivery, open, click, bounce, and complaint events update the matching message.
- In the chat, each outgoing message shows a small status at the bottom right:
  - single tick = sent
  - double tick = delivered
  - double tick highlighted = opened
  - warning icon = bounced or marked as spam (also flagged in the ticket header)
- Hovering shows the exact times.

Worth knowing: "opened" relies on the recipient's email app loading a tracking image, so some opens will never register. Sent, delivered and bounced are reliable.

## 3. Closure shown as a note, not a message

The closure email currently appears as a full outgoing message in the thread. Instead:

- Closure (and similar system emails) render as a centred one-line note: "Ticket closed — customer notified" with the time.
- The full email content is still stored and viewable by expanding the note, so nothing is lost.
- Reopening the ticket adds a matching "Ticket reopened" line.

## Technical notes

- Migration: `cs_messages.provider_message_id`, `cs_messages.delivery_status text`, `cs_messages.delivery_events jsonb default '[]'`, `cs_messages.system_event text` (e.g. `ticket_closed`), `cs_conversations.has_delivery_problem boolean default false`.
- `cs-send-message` and `_shared/cs-auto-email.ts` (`sendAndLog`): store Resend `data.id` in `provider_message_id`, set `delivery_status='sent'`, pass `tags: { cs_conversation_id, cs_message_id }`; set `system_event='ticket_closed'` on the closure log row.
- `resend-webhook`: when a `cs_message_id` tag or matching `provider_message_id` exists, update `delivery_status` (precedence sent < delivered < opened; bounce/complaint always win), append the raw event to `delivery_events`, and set `has_delivery_problem` on bounce/complaint. Existing order-email handling unchanged.
- `cs-resend-fetch`: call `sendTicketReceivedEmail` for conversations it newly creates, plus a retry sweep for open email tickets with `ack_sent_at is null` created within the last hour.
- `cs-close-ticket`: unchanged behaviour; only the logged message gains `system_event`.
- Frontend: `MessageThread.tsx` renders `system_event` rows as a collapsed system line and adds the tick indicator component; `ConversationHeader.tsx` gains "Send confirmation" (admin/cs_agent) and a delivery-problem badge; realtime/query invalidation covers delivery updates.
