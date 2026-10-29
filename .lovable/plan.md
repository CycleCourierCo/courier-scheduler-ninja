# Fix WhatsApp photos in the inbox and the "Add standard CS templates" button

## What's wrong
1. **Photos**: when a customer sends a picture, the app tries to save a copy but every download attempt fails, so it falls back to Meta's raw link. That link only works with Meta's private key, so opening it shows "Authentication Error 401".
2. **"Unknown action"**: the button's code exists, but the live version of the WhatsApp template service is older and doesn't know that action yet.

## Fixes
1. **Find the right download method**
   - Read the service logs for the photo sent at 20:50 to see exactly what SendZen returned for each attempt.
   - Check SendZen's media docs for the correct "download media" address and add it (e.g. passing the phone number ID / using their media proxy), keeping current attempts as fallbacks.
2. **Show pictures inline in the chat**
   - Images display as a thumbnail in the message bubble (tap to open full size); videos/audio get players; documents stay as a file link.
   - Never link to Meta's raw address. If the download fails, show "Photo couldn't be loaded" with a **Retry** button (uses the existing media retry service).
3. **Repair the 20:50 photo** by retrying its download once the fix is live.
4. **Templates button**: redeploy the template service so "Add standard CS templates" works, then confirm it returns a result instead of "Unknown action".

## Technical details
- `_shared/whatsappMediaStore.ts`: add SendZen's documented media endpoint; log status codes only (no tokens/URLs) per attempt.
- `cs-inbound-whatsapp`: when download fails, store attachment with `download_failed: true` and no `lookaside` URL.
- Inbox message renderer: `<img>` for image content types from signed storage URLs; retry button calls `cs-whatsapp-media-retry`.
- Redeploy `whatsapp-templates`, `cs-inbound-whatsapp`, `cs-whatsapp-media-retry`.

## Caveat
If SendZen offers no media download at all, the photo can't be fetched by us; I'd then ask SendZen for their media endpoint.
