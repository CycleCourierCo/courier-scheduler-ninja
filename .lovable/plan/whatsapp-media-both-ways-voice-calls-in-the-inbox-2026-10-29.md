# WhatsApp media both ways + voice calls in the inbox

## What I found
- SendZen's SDK (`wa-api-message-node-js`) only **sends** messages: text, photos, video, audio, documents, buttons and templates. It has no way to download media customers send us, and nothing for calls. The n8n package confirms SendZen signs webhooks with `X-Hub-Signature-256: sha256=…`, which the inbox receiver already checks.
- Using the SDK wouldn't make this easier. It's written for Node, and our backend already calls the same `/v1/messages` endpoint directly. I'll keep the direct calls and copy the SDK's message shapes exactly.
- **Photos customers send:** WhatsApp usually sends a file ID, not a link, so photos and voice notes currently show as "[Photo]" with nothing to open.
- **Our replies with files:** these already go out as links. They need to stay openable for WhatsApp and match the SDK's format (image, video, audio, document).
- **Calls:** the inbox has no call handling. WhatsApp business calling is a separate Meta feature that has to be switched on for the number. SendZen's public docs didn't load, so I couldn't confirm they pass calls through.

## What will change

### 1. Incoming media (customer → us)
- When a photo, video, voice note, document or sticker arrives, fetch the file through SendZen (by its media ID), save it in a private inbox file store, and attach it to the message.
- In the ticket, show photos and videos inline, a player for voice notes, and download links for documents. Only inbox staff can open them, through short-lived links.
- If the download fails, the message still saves with a "Media couldn't be downloaded" note and a retry button.

### 2. Outgoing media (us → customer)
- In WhatsApp tickets, staff can attach photos, videos, audio and PDFs/documents from the reply box, within WhatsApp's size limits per type (checked before upload).
- Files are sent with a link that lasts long enough for WhatsApp to fetch them. Captions go on the first file.
- Each file is tracked as its own message, with sent / delivered / read / failed ticks.

### 3. Voice calls
- Accept call events from the webhook (incoming, missed, answered, ended, with duration).
- Each call appears in the ticket as a call entry ("Missed call", "Call 3m 12s") and in the inbox list, so the ticket goes unread and to the top. Missed calls count as needing a reply.
- This only works if SendZen forwards WhatsApp call events and calling is switched on for your number. If no call events show up once this is live, the next step is to ask SendZen to enable call webhooks. Answering calls inside the app isn't included; that needs a separate live-calling setup.

### 4. Other message types
- Reactions are shown on the message they react to. Replies keep a "replying to" quote. Contact cards and locations get readable cards. Unsupported types show a clear placeholder instead of being dropped.

### 5. Webhook settings
- WhatsApp Centre suggests the right event ticks for the inbox webhook (Incoming message, Delivery status, plus calls if SendZen lists them).

## Technical details
- New private storage bucket `cs-whatsapp-media` with policies allowing inbox staff (same roles as the cs_* tables) to read, and the service role to write.
- `_shared/whatsappInbound.ts` extended: media IDs, call events, reactions, context (reply-to), contacts; still import-free for Vitest.
- `cs-inbound-whatsapp`: downloads media (SendZen media endpoint by ID with `SENDZEN_API_KEY`, falling back to the payload link), stores it under `<conversation>/<message>/`, and saves the call entry as a message with `direction: 'in'` and a call type marker in metadata.
- `cs-send-message`: per-type size checks, SDK-shaped media payloads, one `cs_messages` row per file so each one's ticks are tracked.
- Small migration only if needed: a `kind`/metadata column on `cs_messages` for call entries and reactions (check existing columns first).
- Tests: parser cases for media ID, call events, reactions and replies; size-limit rules.

## Checks
- Signed sample webhooks for photo, voice note, call and status. Confirm the file saves and opens, and the ticks update.
- Not covered until you try it: real phone media and real calls, which depend on SendZen.
