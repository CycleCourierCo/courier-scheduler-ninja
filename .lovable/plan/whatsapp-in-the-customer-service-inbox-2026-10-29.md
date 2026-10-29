# WhatsApp in the Customer Service Inbox

## What already works
- Incoming WhatsApp messages create a contact, a ticket and a message, linked to an order where possible.
- Staff replies on a WhatsApp ticket go out through SendZen and are saved.
- The inbox list has All / Email / WhatsApp filter buttons and a small icon per ticket.

## Gaps to fix
1. **Messages may not be saved at all.** SendZen sends messages in the Meta-style layout (entry → changes → messages). The receiver only reads simple flat fields, so real messages are likely rejected as "from + text required". It also only checks a plain secret header, while SendZen signs each delivery.
2. **No duplicate protection.** If SendZen retries, the same message is saved twice.
3. **Unread count resets to 1** on every new message instead of counting up.
4. **Photos, voice notes, documents, locations and button replies** are dropped (no text).
5. **Delivery tracking missing.** "Delivery status" updates (sent / delivered / read / failed) are ignored, so replies never show as delivered or read.
6. **Flag not obvious.** Only a small icon separates WhatsApp from email.

## What will change
- **Receiver** (`cs-inbound-whatsapp`):
  - Read SendZen/Meta payloads (several messages per delivery), plus the old flat shape.
  - Verify SendZen's signature (HMAC of the raw body with the saved signing secret), keeping the plain header match as a fallback.
  - Skip messages already saved (same message ID).
  - Increase the unread count; reopen closed tickets as a new ticket per current rules.
  - Save non-text messages with a readable label (e.g. "[Photo]", "[Voice note]", "[Location]") and keep the media link/caption as an attachment where SendZen provides one.
  - Apply status updates to the matching sent message (sent → delivered → read, or failed with reason).
- **Inbox list and ticket header:** a clear coloured "WhatsApp" or "Email" label on every ticket, plus the existing filter buttons.
- **Ticket view:** show ticks on staff WhatsApp replies (sent / delivered / read / failed).

## Technical details
- One small migration only if needed: a unique index on `cs_messages(external_id)` for inbound WhatsApp (partial, where not null) so duplicates can't be saved; check existing duplicates first.
- `delivery_status` already exists on `cs_messages`; status events update it by `provider_message_id`/`external_id`.
- Badge uses existing semantic colour tokens (success for WhatsApp, primary for email).
- Add Vitest tests for the payload parser (Meta shape, flat shape, media label, status event) in a shared no-import helper.

## Checks
- Send a sample SendZen payload to the receiver and confirm one ticket/message appears, a repeat is ignored, and a status event updates the reply.
- Not covered: a real phone message, unless you send one after the change.
