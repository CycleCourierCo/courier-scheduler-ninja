

## Add WhatsApp Announcements to Announcement Page

### What it does
Adds a second section to the Announcement page for sending WhatsApp messages via SendZen. The page gets renamed to "Announcements" (covering both Email and WhatsApp). Recipients are shared between both sections. The WhatsApp message is plain text (not HTML).

### Changes

**1. New Edge Function: `supabase/functions/send-announcement-whatsapp/index.ts`**
- Accepts `{ phone, message }` in the request body
- Sends a plain text WhatsApp message via SendZen API (`type: "text"`) to the given phone number
- Uses `EdgeRuntime.waitUntil()` for background processing (same pattern as existing SendZen function)
- Uses existing `SENDZEN_API_KEY` secret (already configured)
- Returns immediately with `{ success: true }`

**2. Update `src/pages/AnnouncementEmailsPage.tsx`**
- Rename page title to "Announcements" with both Mail and MessageSquare icons
- Keep existing Recipients section (shared for both channels)
- Add `phone` to the profile query (`select("id, name, email, phone, role, company_name")`)
- Update `ProfileRecord` interface to include `phone: string | null`
- Keep existing "Compose Email" card unchanged
- Add new "Compose WhatsApp" card below it:
  - Plain text Textarea (no HTML, no preview toggle)
  - Character count indicator
- Replace single send button with two side-by-side buttons:
  - "Send Email" -- sends emails (existing logic, validates subject + htmlBody)
  - "Send WhatsApp" -- sends WhatsApp messages to recipients who have phone numbers, shows count of recipients with phones vs without
- Separate progress bars for each channel
- WhatsApp send loops through recipients with phone numbers, calls `send-announcement-whatsapp` edge function for each, with 500ms delay between sends
- Toast warnings if some recipients lack phone numbers

### WhatsApp recipients logic
- Filters selected recipients to only those with a `phone` field
- Shows "X of Y recipients have phone numbers" below the WhatsApp compose card
- Recipients without phone numbers are silently skipped during send

### Technical note
WhatsApp Business API typically requires pre-approved templates for messages outside a 24-hour conversation window. Plain text messages may only deliver to contacts who have recently messaged the business number. If SendZen rejects text-type messages, the edge function will need to be updated to use a pre-approved announcement template instead.

### Flow
```text
Admin opens Announcements page
  → Selects recipients (individual or by role) -- shared section
  → Composes email (subject + HTML body) in Email card
  → Composes WhatsApp (plain text) in WhatsApp card
  → Clicks "Send Email" → sends emails to all selected with email
  → Clicks "Send WhatsApp" → sends WhatsApp to all selected with phone
  → Progress bars show independently for each channel
```

