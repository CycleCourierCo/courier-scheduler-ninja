## Fix loader WhatsApp 4096-char overflow (management list + bay breakdown missing)

### Root cause
The latest send-loading-list-whatsapp run failed for the loader with:

```
'body' in the text object is required and cannot exceed 4096 characters.
```

`send-loading-list-whatsapp/index.ts` currently sends the loader a single WhatsApp message containing **management overview + bay breakdown** concatenated (`loaderMessage = managementMessage + bayBreakdown.text`). The combined body exceeds SendZen's 4096-char text limit, so the loader receives nothing for the overview or the bay breakdown — only the per-driver follow-ups arrive. Management's WhatsApp (overview only, no bay breakdown) was just under the limit and went through.

### Fix
Edit `supabase/functions/send-loading-list-whatsapp/index.ts` only:

1. Add a small `sendChunkedWhatsApp(apiKey, phone, message, label)` helper that splits any body >~3900 chars at safe boundaries (prefer `\n━━━`, then double newline, then single newline, then hard cut) and sends each chunk sequentially via `sendSendZenMessage`, tagging chunks `(1/N)`, `(2/N)`, …. Returns aggregated ok/data array.
2. Replace the single loader WhatsApp send so the loader receives **two separate WhatsApp messages**:
   - Management overview (`managementMessage`), chunked via helper.
   - Bay breakdown (`bayBreakdown.text`), chunked via helper — only if non-empty.
3. Use the same chunking helper for the **management** WhatsApp send too, so future growth doesn't silently truncate it.
4. Log per-chunk responses with the existing `console.log` / `console.error` pattern, and push each chunk result into the existing `results` array.
5. Leave per-driver WhatsApp/email sends, all email composition, bay-breakdown email injection, and management email behavior unchanged.

### Out of scope
- No client changes, no schema/RLS changes, no new buttons or routes.
- No change to bay-breakdown content/format, management email, driver messages, or templates.
- Not adding bay breakdown to the management recipient.

### Files
- Edit: `supabase/functions/send-loading-list-whatsapp/index.ts`
