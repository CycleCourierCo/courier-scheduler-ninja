## Branded Announcement Email Template

Currently the Announcements page sends whatever raw HTML you paste in the body field. We'll add a reusable Cycle Courier branded wrapper so you only type the message content and the styling is applied automatically.

### What changes

**1. New template builder (`src/utils/announcementEmailTemplate.ts`)**
- Exports `wrapAnnouncementEmail(content: string, subject: string)` that returns full HTML with:
  - Cycle Courier branded header (logo + brand colour bar)
  - White content card with proper padding, system font stack
  - Auto-conversion of plain-text line breaks to `<p>` tags (so you can just type)
  - Footer with company name, address, contact info, and unsubscribe-style note
  - Email-safe inline styles + table layout (works in Gmail, Outlook, Apple Mail)
- A second helper `buildPlainText(content)` strips/normalises for the text fallback

**2. Announcements page (`src/pages/AnnouncementEmailsPage.tsx`)**
- Replace the "HTML Body" textarea label with "Message Content" — guidance text: "Just type your message. Branding, header, and footer are added automatically."
- Add a "Branded preview" toggle that shows the wrapped result in the existing preview panel (instead of raw HTML)
- On send (immediate + scheduled), pass `wrapAnnouncementEmail(htmlBody, subject)` to `send-email` instead of the raw `htmlBody`
- Apply the same wrapping in the Edit Scheduled dialog
- Keep storing the *raw* content in `scheduled_announcements.html_body` so edits stay editable; wrap at send time

**3. Scheduled-send edge function (`supabase/functions/process-scheduled-announcements/index.ts`)**
- Inline the same wrapper (Deno-compatible copy) so scheduled emails get the same branding when the cron job sends them
- Use the wrapped HTML for `html` and plain-text version for `text`

### Out of scope
- WhatsApp message styling (text-only by nature)
- Changing existing transactional emails (order confirmations etc.)
- Switching email infrastructure providers

Want me to proceed?