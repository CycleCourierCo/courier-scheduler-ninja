# Show replies sent from the WhatsApp phone app in the inbox (TCK-1006)

## What I found
TCK-1006 (Umer Siddique) has 7 customer messages and **no** messages from us. None of our replies were sent from the inbox; they were typed in the WhatsApp Business app on the phone. WhatsApp only tells us about those if it sends a "message echo" event. Right now the inbox:
- doesn't read echo events, and
- the SendZen webhook may not be set up to forward them.

## Fix
1. **Read phone-sent messages**: when WhatsApp reports a message the business sent from the phone, save it in the customer's conversation as one of our messages, labelled "Sent from phone". The same message is never saved twice, and these messages don't count as unread or reopen the ticket.
2. **Turn on the event in SendZen**: in WhatsApp Centre → Webhooks, add the message-echo event (if SendZen lists it) to the inbox webhook. I'll do it through the existing webhook settings if I can.
3. **Fill in past messages (best effort)**: use SendZen's event logs to bring in earlier phone-sent replies for recent chats, including TCK-1006, as long as SendZen kept them.
4. **Media/reactions from the phone** show the same way as customer ones (photos inline, reactions as text).

## Caveat
If SendZen doesn't forward phone-sent messages at all, I can't show them. I'll check their event list first and tell you. Messages sent from the inbox already show; only phone-sent ones are missing.

## Technical details
- `_shared/whatsappInbound.ts`: parse `smb_message_echoes` / `message_echoes` (`from` = our number, `to` = customer) into an `echoes` list; add a Vitest case.
- `cs-inbound-whatsapp`: insert echoes as `direction: 'out'`, `status: 'sent'`, `metadata.source = 'phone'`, dedupe on `external_id`, no unread bump.
- Backfill: one-off run via SendZen `GET` event logs filtered to echo events for the last few days.
- UI: small "Sent from phone" tag on those bubbles.
